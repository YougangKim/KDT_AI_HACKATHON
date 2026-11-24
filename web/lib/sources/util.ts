import type { Condition, Domain, Opportunity } from "../types";
import { normalizeRegion, structureConditionsRules } from "../ai/rules";

export const DOMAIN_LABEL: Record<Domain, string> = {
  housing: "주거",
  job: "채용·인턴",
  parttime: "알바",
  benefit: "지원금·혜택",
  training: "국비 과정",
  exam: "자격증 일정",
};

/** "20261130", "2026.11.30", "2026-11-30 10:00", "2026/11/30" → "2026-11-30". 못 읽으면 undefined */
export function toIsoDate(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  const m = s.match(/(\d{4})[.\-/]?\s*(\d{1,2})[.\-/]?\s*(\d{1,2})/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/** "20261101 ~ 20261130" 같은 기간 문자열 → [시작, 끝] */
export function parsePeriod(v: unknown): [string | undefined, string | undefined] {
  if (v == null) return [undefined, undefined];
  const parts = String(v).split(/~|∼|부터/);
  if (parts.length < 2) return [undefined, toIsoDate(parts[0])];
  return [toIsoDate(parts[0]), toIsoDate(parts[1])];
}

export const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** 지역 문자열(여러 개 가능) → 시도 약칭 배열. 전국/없음 → [] */
export function toRegions(...values: unknown[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    for (const part of str(v).split(/[,·/]+/)) {
      const r = normalizeRegion(part);
      if (r) set.add(r);
    }
  }
  return [...set];
}

/**
 * 원문 단어로 뽑는 대상 조건은 그 분야에서 의미 있을 때만 붙인다(불확실한 low 조건이 다른 분야 공고까지
 * "확인 필요"로 바꾸지 않게): 신혼·청약통장은 주거, 경력·학력은 채용·알바·훈련
 */
function fitsDomain(attr: Condition["attr"], domain: Domain): boolean {
  if (attr === "married" || attr === "subscription") return domain === "housing";
  if (attr === "experienced" || attr === "education") return domain === "job" || domain === "parttime" || domain === "training";
  return true;
}

/** 분야 조건 + 지역 조건 + 자격요건 원문 규칙 구조화 */
export function buildConditions(domain: Domain, region: string[], eligibility: string, extra: Condition[] = []): Condition[] {
  const conds: Condition[] = [{ attr: "interest", op: "eq", value: domain, rawText: `분야: ${DOMAIN_LABEL[domain]}`, confidence: "high" }];
  if (region.length) conds.push({ attr: "region", op: "in", value: region, rawText: `대상 지역: ${region.join("·")}`, confidence: "high" });
  conds.push(...extra);
  const ruled = structureConditionsRules(eligibility).filter((c) => c.attr !== "region" && !extra.some((e) => e.attr === c.attr) && fitsDomain(c.attr, domain));
  conds.push(...ruled);
  return conds;
}

/** 마감이 지난 공고는 뺀다(마감 없음=상시는 유지) */
export function isOpen(o: Pick<Opportunity, "applyEnd">, today: string): boolean {
  return !o.applyEnd || o.applyEnd >= today;
}

export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 첫 쪽의 전체 건수(totalCount 등)를 보고 필요한 쪽 수만큼 동시에 받아 합친다(공고 전체 조회).
 * 첫 쪽이 실패하면 throw. 뒤쪽 실패는 경고 로그로 남기고(몇 쪽이 빠졌는지) 받은 것만 쓴다.
 */
export async function fetchAllPages<T>(
  label: string,
  perPage: number,
  maxPages: number,
  loadRaw: (page: number) => Promise<unknown>,
  map: (raw: unknown) => T[],
): Promise<T[]> {
  const first = await loadRaw(1);
  const total = totalCountOf(first);
  const pages = Math.min(maxPages, Math.max(1, Math.ceil(total / perPage)));
  let failed = 0;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      loadRaw(i + 2).then(map).catch(() => {
        failed++;
        return [] as T[];
      }),
    ),
  );
  if (failed) console.warn(`[sources] ${label}: ${pages}쪽 중 ${failed}쪽 조회 실패(받은 쪽만 사용)`);
  if (total > perPage * maxPages) console.warn(`[sources] ${label}: 전체 ${total}건 중 ${perPage * maxPages}건까지만 조회`);
  return [map(first), ...rest].flat();
}

/** 응답의 전체 건수(totalCount·matchCount·ALL_CNT). 못 찾으면 0 */
export function totalCountOf(raw: unknown): number {
  const m = JSON.stringify(raw ?? {}).match(/"(?:totalCount|matchCount|ALL_CNT)"\s*:\s*"?(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** 타임아웃이 있는 JSON fetch. 실패하면 throw */
export async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // data.go.kr는 키 오류 시 XML 오류 본문을 돌려준다
    throw new Error(`JSON 아님: ${text.slice(0, 120)}`);
  }
}

/** 응답 안 어딘가의 배열을 경로 후보 순서대로 찾는다 */
export function pickArray(raw: unknown, paths: string[][]): Record<string, unknown>[] {
  const at = (p: string[]) => p.reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined), raw);
  for (const p of paths) {
    const v = at(p);
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  // XML→JSON 변환 API는 1건이면 배열 대신 객체로 준다
  for (const p of paths) {
    const v = at(p);
    if (v && typeof v === "object") return [v as Record<string, unknown>];
  }
  return [];
}

/** 저장하는 자격요건 원문 최대 길이(공고 DB 용량 관리) */
export const ELIGIBILITY_MAX = 1000;

/**
 * 매핑한 공고에 자격요건 원문을 붙인다. 공고 필드로 저장되므로 객체를 복사해도 남고 공고 DB에도 쌓여,
 * 다음 수집·요약·Jev 판정이 원문을 다시 받아 오지 않고 재사용한다
 */
export function withEligibility(o: Opportunity, text: string): Opportunity {
  const t = text.replace(/\s+/g, " ").trim().slice(0, ELIGIBILITY_MAX);
  return t ? { ...o, eligibility: t } : o;
}
export function getEligibility(o: Opportunity): string | undefined {
  return o.eligibility || undefined;
}

/** 화면(브라우저)으로 보내는 공고에서 서버 전용 원문을 뺀다(전송량·노출 최소화) */
export function forClient(o: Opportunity): Opportunity {
  if (o.eligibility === undefined) return o;
  const rest = { ...o };
  delete rest.eligibility;
  return rest;
}
