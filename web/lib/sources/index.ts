// 공고 수집 진입점. 실제 출처만 사용하며 키 없음·실패·0건은 빈 결과로 처리한다.
import type { Condition, Domain, Opportunity } from "../types";
import { aiEnabled, structureConditions } from "../ai";
import type { SourceAdapter } from "./types";
import { getEligibility, isOpen, todayKst } from "./util";
import { lhNotice } from "./lh-notice";
import { myhome } from "./myhome";
import { jobalio } from "./jobalio";
import { gov24 } from "./gov24";
import { youthcenter } from "./youthcenter";
import { work24Training } from "./work24-training";
import { qnet } from "./qnet";
import { applyhome } from "./applyhome";
import { saramin } from "./saramin";
import { searchWeb } from "./websearch";
import { fetchShRss } from "./sh-rss";
import { dedupeOpportunities } from "./dedupe";

export const ALL_DOMAINS: Domain[] = ["housing", "job", "parttime", "benefit", "training", "exam"];

export const ADAPTERS: SourceAdapter[] = [lhNotice, myhome, applyhome, jobalio, saramin, gov24, youthcenter, work24Training, qnet];

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; items: Opportunity[] }>();
const AI_ENRICH_LIMIT = 15;
const aiConditionCache = new Map<string, Condition[]>();

/** 테스트용 */
export function _clearCache() {
  cache.clear();
  aiConditionCache.clear();
}

async function runAdapter(a: SourceAdapter, now: Date): Promise<Opportunity[]> {
  if (!process.env[a.envKey]) return [];
  const hit = cache.get(a.id);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.items;
  try {
    const items = await a.fetch(now);
    cache.set(a.id, { at: now.getTime(), items });
    return items;
  } catch (e) {
    console.warn(`[sources] ${a.id} 조회 실패:`, (e as Error).message);
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

/** 분야별 공고를 모은다. domains 생략 시 6개 분야 전체 */
export async function loadOpportunities(domains: Domain[] = ALL_DOMAINS, now: Date = new Date(), opts: { waitAi?: boolean } = {}): Promise<Opportunity[]> {
  const wanted = domains.filter((d) => ALL_DOMAINS.includes(d));
  const adapters = ADAPTERS.filter((a) => a.domains.some((d) => wanted.includes(d)));
  const [live, web] = await Promise.all([
    Promise.all(adapters.map((a) => runAdapter(a, now))).then((r) => r.flat()),
    searchWeb(wanted, now), // 선택 기능: 기본 OFF
  ]);
  const rss = wanted.includes("housing") ? await fetchShRss(now) : []; // 선택 기능: SH 공식 RSS, 기본 OFF
  const today = todayKst(now);

  const out: Opportunity[] = [];
  const seen = new Set<string>();
  for (const d of wanted) {
    const liveOpen = live.filter((o) => o.domain === d && isOpen(o, today));
    const picked = await enrichWithAi(liveOpen, opts.waitAi ?? false);
    for (const o of picked) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  for (const o of [...rss, ...web]) {
    if (seen.has(o.id) || out.some((x) => x.url === o.url)) continue; // 공식 API에 이미 있는 원문은 중복 제외
    seen.add(o.id);
    out.push(o);
  }
  return dedupeOpportunities(out.filter((o) => !o.isSample && o.origin !== "sample"));
}

/** "housing,benefit" → Domain[] (알 수 없는 값은 버림). 비거나 모두 무효면 전체 */
export function parseDomains(param: string | null | undefined): Domain[] {
  if (!param) return ALL_DOMAINS;
  const list = param.split(",").map((s) => s.trim()).filter((s): s is Domain => (ALL_DOMAINS as string[]).includes(s));
  return list.length ? [...new Set(list)] : ALL_DOMAINS;
}
