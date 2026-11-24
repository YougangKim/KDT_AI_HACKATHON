// 공고 수집 진입점. 실제 출처만 사용하며 키 없음·실패·0건은 빈 결과로 처리합니다.
import type { Condition, Domain, Opportunity } from "../types";
import { normalizeRegion } from "../ai/rules";
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
  // 교차 평가 결과(규칙 정밀도 91% > AI 70%) 규칙 조건은 모두 유지하고, AI는 규칙이 못 찾은 속성만 보완합니다
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
  // 새 조건은 원문에 근거 단어가 있어야 합니다(AI가 지어낸 대상 조건으로 잘못 탈락시키지 않게)
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
      // 영구 캐시 적중은 위에서 처리하므로 신규 AI 요청만 상한을 차감합니다.
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
  const located = await attachGeo(attachPlaces(deduped), opts.full ? 3000 : undefined);
  return located.map(inferRegion).map(inferJobConditions);
}

const SIDO_TOKEN = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|전북특별자치도|강원특별자치도|제주특별자치도)(특별시|광역시|특별자치시|특별자치도|도|시)?$/;

/**
 * 지역 정보가 비어 있는 공고의 지역을 원문으로 판별한다(지역 필터가 다른 지역 공고를 거르도록).
 * - 제목·기관명에 시·도 이름이 단독 낱말로 있으면 그 지역(예: "부산 청년 월세", "경기도 ○○") — "서울대학교" 같은 고유명사는 제외
 * - 주거 공고는 카카오가 찾은 단지 주소의 시·도
 * - 시·도가 2개 이상이거나 근거가 없으면 전국 공고로 둔다
 */
export function inferRegion(o: Opportunity): Opportunity {
  if (o.region.length || o.domain === "exam" || o.domain === "training") return o;
  // 채용·알바는 기관명(본사 소재지)을 근무 지역 근거로 쓰지 않는다
  const recruit = o.domain === "job" || o.domain === "parttime";
  const tokens = (recruit ? o.title : `${o.title} ${o.org}`).replace(/[[\]()<>「」『』]/g, " ").split(/[\s,·/]+/);
  const found = new Set(tokens.filter((t) => SIDO_TOKEN.test(t)).map((t) => normalizeRegion(t)).filter((r): r is string => !!r));
  if (!found.size && o.domain === "housing" && o.geo?.address && o.geo.precision !== "region") {
    const r = normalizeRegion(o.geo.address.split(" ")[0]);
    if (r) found.add(r);
  }
  if (found.size !== 1) return o;
  const region = [...found];
  return {
    ...o,
    region,
    conditions: [...o.conditions, { attr: "region", op: "in", value: region, rawText: `대상 지역: ${region[0]}(공고 원문으로 판별)`, confidence: "high" }],
  };
}

/** 이전 수집분에 남은 채용·알바의 시·도 중심 좌표(근무지 근거 없음)를 지도에서 뺀다 */
export function dropRecruitRegionPin(o: Opportunity): Opportunity {
  if ((o.domain !== "job" && o.domain !== "parttime") || o.geo?.precision !== "region") return o;
  return { ...o, geo: undefined };
}

/** 분야별 공고를 모은다. fixture는 기존 경로, 운영 요청은 저장된 공고 풀을 우선합니다. */
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
  // 저장된 풀이 판별 규칙 추가 이전에 모은 것이어도 경력·직무 조건을 보충한다(이미 있으면 그대로)
  if (fresh) return stored.items.filter((item) => wanted.includes(item.domain)).map(dropRecruitRegionPin).map(inferJobConditions);

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

import { OPEN_FIELD, UNSPECIFIED_FIELD } from "./field";
export { OPEN_FIELD, UNSPECIFIED_FIELD };

/** 전문직 제한 없는 일반 채용인지: 경력·자격·면허·전문 표시가 없고 신입·공채·인턴·무관 표시가 있을 때 */
export function isOpenRecruit(text: string): boolean {
  // 채용박람회·현장채용 행사·지원사업은 직무 제한 없이 누구나 참여
  if (/박람회|채용행사|수요데이|만남의\s*날|채용설명회|현장채용|면접행사|지원사업|응시료|공무직|동행일자리|통합채용|참여자\s*모집|기간제노동자/.test(text)) return true;
  if (/경력(?!\s*무관)|자격|면허|전문(?!인턴)|기술직|기능직|연구직/.test(text.replace(/신입\s*[/·및,]\s*경력|경력\s*[/·및,]\s*신입/g, ""))) return false;
  return /신입|공개채용|공채|수시채용|인턴|학력\s*무관|경력\s*무관|직원\s*채용|채용\s*공고|일반직|사원\s*채용|직원\s*모집|수시\s*채용|지원|운영/.test(text);
}

/** 직무 분야 판별 키워드(NCS 대분류). 공고 제목에서 기관명을 뺀 부분으로만 판단한다 */
const FIELD_KEYWORDS: [string, RegExp][] = [
  ["정보통신", /(^|[^A-Za-z])IT([^A-Za-z]|$)|전산|정보보안|정보화|정보시스템|소프트웨어|SW|데이터|네트워크|서버|클라우드|Cloud|개발자|프로그래머|인공지능|AI|게임|DBA|백엔드|프론트엔드|웹개발|앱개발|빌드시스템|모바일플랫폼|보안관제|보안운영|DevOps|FW|BSP|펌웨어|임베디드|시큐|정보기술|ICT/],
  ["전기·전자", /전기|전자|반도체|계측/],
  ["화학·바이오", /바이오|화학|약물|의약|약품|제약|임상|허가|품질관리|QC|QA|미생물|세포|제제|화장품|뷰티|약대|화공|수소|노믹스|팜/],
  ["보건·의료", /간호|의료|병원|보건|약사|방사선|물리치료|임상병리|치료사|요양/],
  ["문화·예술·디자인·방송", /학예|미술|박물관|예술|디자인|방송|공연|전시|콘텐츠|영상|편집|기자|UI|UX|시나리오|웹툰/],
  ["경영·회계·사무", /사무|행정|회계|인사|총무|경영|재무|기획|서무|경리|구매|비서|HR|사업개발|PM|CS|세무|노무|정산|Accounting|Reporting|관리직|일반직|행정직/],
  ["건설", /건설|토목|건축|플랜트|시공|현장관리/],
  ["기계", /기계|설비|정비|설계|생산|제조|조선|자동차|선박|시트|시험부문|트랜시스/],
  ["환경·에너지·안전", /환경|에너지|안전/],
  ["교육·자연·사회과학", /연구원|연구소|연구개발|R&D|교육|강사|교사|분석|번역/],
  ["사회복지·종교", /복지|상담/],
  ["이용·숙박·여행·오락·스포츠", /관광|여행|호텔|레저|스포츠/],
  ["사업관리", /테크노파크|진흥원|사업관리/],
  ["음식서비스", /조리|영양|바리스타|카페/],
  ["경비·청소", /경비|청소|미화|시설서비스/],
  ["영업판매", /영업|판매|마케팅|마케터|Marketing|MD|유통|매장|광고|트레이딩|무역|카마스터|도우미/],
  ["법률·경찰·소방·교도·국방", /변호사|노무사|법무|법률|소방|경찰|군무원|부사관|국방/],
  ["식품가공", /식품|수산|제과|베이커리/],
  ["금융·보험", /금융|은행|보험|증권|투자|뱅크|예탁|보증|손해사정|생명|카드|캐피탈/],
  ["운전·운송", /운전|운송|물류|배송|택배|항공|납품|탑차|주차/],
];

/**
 * 채용 공고에 빠진 경력·직무 조건을 제목으로 보충한다.
 * - 제목에 "경력"이 있고 신입·무관·인턴 표시가 없으면 경력직 전용(경력 없음이면 탈락)
 * - 직무 분야 조건이 없으면 제목 키워드로 분야를 붙인다(여러 개면 모두, 없으면 그대로 둬서 남긴다)
 */
export function inferJobConditions(o: Opportunity): Opportunity {
  if (o.domain !== "job" && o.domain !== "parttime") return o;
  const title = (o.org ? o.title.split(o.org).join(" ") : o.title).replace(/\s+/g, " ");
  // 이전 규칙으로 붙인 추정 조건은 지우고 다시 판별한다(저장된 풀도 최신 규칙으로)
  const inferred = (c: Condition) => (c.attr === "field" || c.attr === "experienced") && /판별\)$|적혀 있지 않음$/.test(c.rawText);
  const base = o.conditions.filter((c) => !inferred(c));
  const conditions = [...base];
  if (!conditions.some((c) => c.attr === "experienced") && /경력/.test(title) && !/신입|무관|경력\s*없|인턴|경력단절/.test(title)) {
    conditions.push({ attr: "experienced", op: "eq", value: true, rawText: "경력직 채용(공고 제목으로 판별)", confidence: "high" });
  }
  if (!conditions.some((c) => c.attr === "field")) {
    // 제목(기관명 제외)에서 먼저 찾고, 없으면 기관명까지 포함해 찾는다(예: ○○약품 신입 모집 → 화학·바이오)
    const find = (t: string) => FIELD_KEYWORDS.filter(([, re]) => re.test(t)).map(([f]) => f);
    // 제목(기관명 제외) → 요약 → 기관명 순으로 찾는다
    const fields = [title, o.summary ?? "", `${o.org ?? ""} ${o.title}`].map(find).find((f) => f.length) ?? [];
    // 분야를 못 찾은 공고는 전문직 제한이 있는지로 나눈다:
    //  - 경력·자격·면허·전문직 표시가 있으면 "분야 미표기"(직무를 원문에서 확인해야 함)
    //  - 신입·공개채용·인턴·학력무관처럼 직무 제한 없는 일반 채용이면 "직무 무관"
    if (fields.length) conditions.push({ attr: "field", op: "in", value: fields, rawText: `직무 분야: ${fields.join(", ")}(공고 제목으로 판별)`, confidence: "high" });
    else if (isOpenRecruit(`${title} ${o.summary ?? ""}`)) conditions.push({ attr: "field", op: "in", value: [OPEN_FIELD], rawText: "직무 제한 없는 일반 채용(공고 제목으로 판별)", confidence: "high" });
    else conditions.push({ attr: "field", op: "in", value: [UNSPECIFIED_FIELD], rawText: "직무 분야가 공고에 적혀 있지 않음", confidence: "high" });
  }
  return { ...o, conditions };
}
