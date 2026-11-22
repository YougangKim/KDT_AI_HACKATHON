import type { AnswerRecord, Match, Opportunity } from "@/lib/types";

export type LastResult = { answers: AnswerRecord[]; matches: Match[]; pool?: Opportunity[] };

export function readLastResult(): LastResult | null {
  try {
    const raw = sessionStorage.getItem("lastResult");
    if (!raw) return null;
    const r = JSON.parse(raw) as LastResult;
    return Array.isArray(r.matches) ? {
      answers: r.answers ?? [],
      matches: r.matches.filter((m) => !m.opportunity.isSample && m.opportunity.origin !== "sample"),
      pool: r.pool?.filter((o) => !o.isSample && o.origin !== "sample"),
    } : null;
  } catch {
    return null;
  }
}

