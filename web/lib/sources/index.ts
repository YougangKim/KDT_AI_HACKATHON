// 공고 수집 진입점. 실제 출처만 사용하며 키 없음·실패·0건은 빈 결과로 처리한다.
import type { Condition, Domain, Opportunity } from "../types";
import { aiEnabled, cachedStructuredConditions, structureConditions } from "../ai";
import { regionsIn } from "../ai/rules";
import { attachGeo } from "../geo/geocode";
import { attachPlaces, _clearExtractCache } from "../geo/extract";
import type { SourceAdapter } from "./types";
import { getEligibility, isOpen, todayKst, withEligibility } from "./util";
import { lhNotice } from "./lh-notice";
import { myhome } from "./myhome";
import { jobalio } from "./jobalio";
import { gov24 } from "./gov24";
import { youthcenter } from "./youthcenter";
import { work24Training } from "./work24-training";
import { work24Recruit } from "./work24-recruit";
import { seoulRecruit } from "./seoul-recruit";
import { qnet } from "./qnet";
import { applyhome } from "./applyhome";
import { saramin } from "./saramin";
import { searchWeb } from "./websearch";
import { fetchShRss } from "./sh-rss";
import { dedupeOpportunities } from "./dedupe";
import { addTargetConditions } from "./targets";

export const ALL_DOMAINS: Domain[] = ["housing", "job", "parttime", "benefit", "training", "exam"];

export const ADAPTERS: SourceAdapter[] = [lhNotice, myhome, applyhome, jobalio, saramin, gov24, youthcenter, work24Training, work24Recruit, seoulRecruit, qnet];

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; items: Opportunity[] }>();
const AI_ENRICH_LIMIT = 15;
export interface SourceRunMeta {
  source: string;
  ok: boolean;
  count: number;
  durationMs: number;
  calls: number;
  error?: string;
}
const aiConditionCache = new Map<string, Condition[]>();

/** 테스트용 */
export function _clearCache() {
  cache.clear();
  aiConditionCache.clear();
  _clearExtractCache();
}

async function runAdapter(
  a: SourceAdapter,
  now: Date,
  options: { full?: boolean; onSource?: (meta: SourceRunMeta) => void } = {},
): Promise<Opportunity[]> {
  const started = Date.now();
  let calls = 0;
  if (!process.env[a.envKey]) {
    options.onSource?.({ source: a.id, ok: true, count: 0, durationMs: Date.now() - started, calls });
    return [];
  }
  const hit = cache.get(a.id);
  if (!options.full && hit && now.getTime() - hit.at < TTL_MS) {
    options.onSource?.({ source: a.id, ok: true, count: hit.items.length, durationMs: Date.now() - started, calls });
    return hit.items;
  }
  try {
    const items = await a.fetch(now, { full: options.full, onRequest: () => calls++ });
    if (!calls) calls = 1;
    cache.set(a.id, { at: now.getTime(), items });
    options.onSource?.({ source: a.id, ok: true, count: items.length, durationMs: Date.now() - started, calls });
    return items;
  } catch (e) {
    const error = (e as Error).message;
    console.warn(`[sources] ${a.id} 조회 실패:`, error);
    options.onSource?.({ source: a.id, ok: false, count: 0, durationMs: Date.now() - started, calls: calls || 1, error });
    return [];
  }
}

/** AI가 해석한 조건을 공고에 입힌다(규칙 조건 우선, AI는 빈 속성만 채움) */
function applyAi(o: Opportunity, conds: Condition[]): Opportunity {
  // 교차 평가 결과(규칙 정밀도 91% > AI 70%) 규칙 조건은 모두 유지하고, AI는 규칙이 못 찾은 속성만 보완한다
  const keep = o.conditions;
  const add = conds
    .filter((c) => c.attr !== "interest" && !keep.some((k) => k.attr === c.attr) && plausibleAiCondition(c))
    .map((c) => ({ ...c, aiGenerated: true }));
  return { ...o, conditions: [...keep, ...add] };
}

/** AI가 뽑은 조건 중 근거가 약해 잘못 탈락시킬 수 있는 것은 버린다 */
export function plausibleAiCondition(c: Condition): boolean {
  const v = typeof c.value === "number" ? c.value : NaN;
  if (c.attr === "age") {
    if (c.op === "gte" && !(v > 15)) return false; // 0세·15세 이상은 청년이면 누구나 통과
    if (c.op === "lte" && v >= 45) return false; // 정년(59·60세) 같은 상한은 청년과 무관
  }
  if (c.attr === "region" && !/거주|주민등록|소재|관내|출신/.test(c.rawText)) return false; // 기관명 속 지명(예: 세종학당재단) 오인 방지
  if (c.attr === "homeless" && !/무주택/.test(c.rawText)) return false;
  // "근로·사업소득이 있는 자"처럼 소득 문구를 취업 상태로 오해하는 경우 방지
  if (c.attr === "employment" && !/취업|재직|구직|실업|재학|휴학|학생|근로자|직장|졸업/.test(c.rawText)) return false;
  // 새 조건은 원문에 근거 단어가 있어야 한다(AI가 지어낸 대상 조건으로 잘못 탈락시키지 않게)
  if (c.attr === "subscription" && !/청약/.test(c.rawText)) return false;
  if (c.attr === "married" && !/신혼|혼인|결혼/.test(c.rawText)) return false;
  if (c.attr === "welfare" && !/수급|차상위/.test(c.rawText)) return false;
  if (c.attr === "experienced" && !/경력/.test(c.rawText)) return false;
  if (c.attr === "education" && !/졸|학력|학사|석사|박사/.test(c.rawText)) return false;
  return true;
}

const aiPending = new Set<string>(); // 뒤에서 해석 중인 공고(중복 호출 방지)
const AI_CONCURRENCY = 2; // 무료 등급(Gemini) 분당 한도 때문에 동시에 2건만

/** 키가 있으면 실데이터 자격요건을 AI(Claude 또는 Gemini)로 다시 구조화(분야·지역 조건은 유지) */
async function enrichWithAi(items: Opportunity[], wait: boolean): Promise<Opportunity[]> {
  if (!aiEnabled()) return items;
  if (!wait) {
    // 화면 요청은 AI를 기다리지 않는다: 이미 해석한 공고만 AI 조건을 쓰고, 나머지는 뒤에서 해석해 다음 요청부터 반영
    const todo = items.filter((o) => !aiConditionCache.has(o.id) && !aiPending.has(o.id) && getEligibility(o));
    todo.forEach((o) => aiPending.add(o.id));
    if (todo.length) void enrichWithAi(todo, true).catch(() => {}).finally(() => todo.forEach((o) => aiPending.delete(o.id)));
    return items.map((o) => (aiConditionCache.has(o.id) ? applyAi(o, aiConditionCache.get(o.id)!) : o));
  }
  let budget = AI_ENRICH_LIMIT;
  const enrich = async (o: Opportunity): Promise<Opportunity> => {
    const raw = getEligibility(o);
    if (!raw) return o;
    let conds = aiConditionCache.get(o.id);
    if (!conds) {
      conds = await cachedStructuredConditions(raw) ?? undefined;
      if (conds) aiConditionCache.set(o.id, conds);
    }
    if (!conds) {
      // 영구 캐시 적중은 위에서 처리하므로 신규 AI 요청만 상한을 차감한다.
      if (budget-- <= 0) return o;
      conds = await structureConditions(raw);
      aiConditionCache.set(o.id, conds);
    }
    return applyAi(o, conds);
  };
  const out: Opportunity[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await enrich(items[i]);
    }
  };
  await Promise.all(Array.from({ length: AI_CONCURRENCY }, worker));
  return out;
}

export async function collectLiveOpportunities(
  domains: Domain[] = ALL_DOMAINS,
  now: Date = new Date(),
  opts: {
    waitAi?: boolean;
    full?: boolean;
    adapters?: SourceAdapter[];
    onSource?: (meta: SourceRunMeta) => void;
  } = {},
): Promise<Opportunity[]> {
  const wanted = domains.filter((d) => ALL_DOMAINS.includes(d));
  const fixture = await readFixture();
  const adapters = (opts.adapters ?? ADAPTERS).filter((a) => a.domains.some((d) => wanted.includes(d)));
  // 테스트 파일이 있으면 어댑터 응답만 그 파일로 바꾸고, 마감·AI·중복 제거 등 후처리는 운영과 똑같이 거친다
  const [live, web] = fixture
    ? [fixture, []]
    : await Promise.all([
        Promise.all(adapters.map((a) => runAdapter(a, now, opts))).then((r) => r.flat()),
        opts.full ? [] : searchWeb(wanted, now), // 선택 기능은 라이브 경로에서만
      ]);
  const rss = !fixture && !opts.full && wanted.includes("housing") ? await fetchShRss(now) : [];
  const today = todayKst(now);

  const out: Opportunity[] = [];
  const seen = new Set<string>();
  for (const d of wanted) {
    const liveOpen = live.filter((o) => o.domain === d && isOpen(o, today)).map((o) => {
      const el = getEligibility(o) ?? "";
      return withEligibility(addTargetConditions(o, el), el); // 새 객체에도 자격요건 원문 유지(AI 해석용)
    });
    const picked = await enrichWithAi(liveOpen, opts.waitAi ?? false);
    for (const o of picked) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  for (const raw of [...rss, ...web]) {
    // 웹 검색·RSS 결과는 지역 정보가 없으므로 제목의 시도명을 지역으로 쓴다(서울시 청년안심주택 → 서울)
    const titleRegions = raw.region.length ? raw.region : regionsIn(raw.title);
    const o = titleRegions.length && !raw.region.length
      ? { ...raw, region: titleRegions, conditions: [...raw.conditions, { attr: "region" as const, op: "in" as const, value: titleRegions, rawText: `대상 지역: ${titleRegions.join("·")}`, confidence: "high" as const }] }
      : raw;
    if (seen.has(o.id) || out.some((x) => x.url === o.url)) continue; // 공식 API에 이미 있는 원문은 중복 제외
    seen.add(o.id);
    out.push(o);
  }
  const deduped = dedupeOpportunities(out.filter((o) => !o.isSample && o.origin !== "sample" && !notForYouth(o)));
  // 일괄 수집은 시간 여유가 있으니 카카오 좌표 조회를 넉넉히(무료 한도 일 10만 회 안쪽)
  return attachGeo(attachPlaces(deduped), opts.full ? 3000 : undefined);
}

/** 분야별 공고를 모은다. fixture는 기존 경로, 운영 요청은 저장된 공고 풀을 우선한다. */
export async function loadOpportunities(
  domains: Domain[] = ALL_DOMAINS,
  now: Date = new Date(),
  opts: { waitAi?: boolean } = {},
): Promise<Opportunity[]> {
  const wanted = domains.filter((d) => ALL_DOMAINS.includes(d));
  if (await readFixture()) return collectLiveOpportunities(wanted, now, opts);

  const { readPool, triggerPoolCollection } = await import("../server/pool");
  const stored = await readPool();
  // 비어 있는 풀(전 출처 실패)은 신선해도 쓰지 않는다
  const fresh = stored && stored.items.length > 0 && now.getTime() - new Date(stored.meta.collectedAt).getTime() < 6 * 60 * 60 * 1000;
  if (fresh) return stored.items.filter((item) => wanted.includes(item.domain));

  triggerPoolCollection(now);
  return collectLiveOpportunities(wanted, now, opts);
}

/**
 * 로컬 시나리오 테스트 전용: E2E_LOCAL=1 이고 OPPORTUNITIES_FIXTURE에 JSON 경로가 있으면 어댑터 응답 대신 그 파일을 매번 읽는다
 * (테스트 중 새 공고를 파일에 추가해 반복 조사를 검증). 배포 환경(VERCEL)에서는 무시하고,
 * 파일 내용이 null이거나 읽기에 실패하면 실제 출처를 쓴다.
 */
async function readFixture(): Promise<Opportunity[] | null> {
  const path = process.env.OPPORTUNITIES_FIXTURE;
  if (!path || process.env.E2E_LOCAL !== "1" || process.env.VERCEL) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const list = JSON.parse(await readFile(path, "utf8")) as unknown;
    return Array.isArray(list) ? (list as Opportunity[]) : null;
  } catch (e) {
    console.warn("[sources] 테스트 공고 파일을 읽지 못해 실제 출처를 씁니다:", (e as Error).message);
    return null;
  }
}

/** 청년이 신청할 수 없는 대상 전용 주거·지원 공고(고령자·노인·중장년 전용). 채용(노인복지관 채용 등)과 "청년"이 들어간 공고는 남긴다 */
export function notForYouth(o: Pick<Opportunity, "title" | "domain">): boolean {
  if (o.domain !== "housing" && o.domain !== "benefit") return false;
  return /고령자|노인|어르신|중장년/.test(o.title) && !/청년/.test(o.title);
}

/** "housing,benefit" → Domain[] (알 수 없는 값은 버림). 비거나 모두 무효면 전체 */
export function parseDomains(param: string | null | undefined): Domain[] {
  if (!param) return ALL_DOMAINS;
  const list = param.split(",").map((s) => s.trim()).filter((s): s is Domain => (ALL_DOMAINS as string[]).includes(s));
  return list.length ? [...new Set(list)] : ALL_DOMAINS;
}
