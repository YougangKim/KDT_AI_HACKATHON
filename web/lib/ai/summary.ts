import { FAST_MODEL, ask } from ".";
import { getCached, setCached } from "./cache";
import type { Opportunity } from "../types";
import { getEligibility } from "../sources/util";

const SUMMARY_PROMPT_VERSION = "summary-v2";

export interface OpportunitySummary {
  id: string;
  summary: string;
  how: string;
}

const cache = new Map<string, OpportunitySummary>();

export function _clearSummaryCache() {
  cache.clear();
}

export function cachedSummaries(ids: string[]): OpportunitySummary[] {
  return ids.flatMap((id) => {
    const hit = cache.get(id);
    return hit ? [hit] : [];
  });
}

export function parseSummariesJson(text: string, allowed: Set<string>): OpportunitySummary[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(value)) return null;
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (!allowed.has(String(row.id)) || typeof row.summary !== "string" || typeof row.how !== "string") return [];
      const summary = row.summary.trim();
      const how = row.how.trim();
      return summary && summary.length <= 80 && how && how.length <= 100
        ? [{ id: String(row.id), summary, how }]
        : [];
    });
  } catch {
    return null;
  }
}

function input(item: Opportunity): string {
  return `${SUMMARY_PROMPT_VERSION}\n${JSON.stringify({
    id: item.id,
    제목: item.title,
    기관: item.org,
    요약: item.summary,
    자격요건: getEligibility(item) ?? "",
    신청방법: item.apply?.how ?? "",
  })}`;
}

export async function summarizeOpportunities(items: Opportunity[]): Promise<OpportunitySummary[]> {
  const missing: Opportunity[] = [];
  for (const item of items) {
    if (cache.has(item.id)) continue;
    const hit = await getCached<OpportunitySummary | false>("summary", input(item));
    if (hit === false) continue;
    if (hit) cache.set(item.id, hit);
    else missing.push(item);
  }

  if (missing.length) {
    const text = await ask(
      FAST_MODEL,
      '한국 청년 공고를 쉽게 요약한다. 각 공고마다 "무엇을 지원하는지" 한 문장(40자 이내)과 "신청할 때 할 일" 한 문장을 작성한다. 입력에 없는 금액·자격·절차는 만들지 않는다. JSON 배열만 출력한다: [{"id":"...","summary":"...","how":"..."}]',
      JSON.stringify(missing.map((item) => JSON.parse(input(item).split("\n").slice(1).join("\n")))),
      600,
    );
    const parsed = text ? parseSummariesJson(text, new Set(missing.map((item) => item.id))) : null;
    const byId = new Map(parsed?.map((item) => [item.id, item]));
    await Promise.all(missing.map(async (item) => {
      const result = byId.get(item.id);
      if (result) {
        cache.set(item.id, result);
        await setCached("summary", input(item), result, 365);
      } else {
        await setCached("summary", input(item), false, 1);
      }
    }));
  }
  return cachedSummaries(items.map((item) => item.id));
}
