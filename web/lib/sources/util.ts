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

/** 분야 조건 + 지역 조건 + 자격요건 원문 규칙 구조화 */
export function buildConditions(domain: Domain, region: string[], eligibility: string, extra: Condition[] = []): Condition[] {
  const conds: Condition[] = [{ attr: "interest", op: "eq", value: domain, rawText: `분야: ${DOMAIN_LABEL[domain]}`, confidence: "high" }];
  if (region.length) conds.push({ attr: "region", op: "in", value: region, rawText: `대상 지역: ${region.join("·")}`, confidence: "high" });
  conds.push(...extra);
  const ruled = structureConditionsRules(eligibility).filter((c) => c.attr !== "region" && !extra.some((e) => e.attr === c.attr));
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

/** 매핑한 공고의 자격요건 원문을 기억해 둔다(AI 재구조화용). Opportunity 타입은 건드리지 않는다 */
const eligibilityText = new WeakMap<Opportunity, string>();
export function withEligibility(o: Opportunity, text: string): Opportunity {
  if (text.trim()) eligibilityText.set(o, text.trim());
  return o;
}
export function getEligibility(o: Opportunity): string | undefined {
  return eligibilityText.get(o);
}
