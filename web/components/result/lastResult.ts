import type { Answer, AnswerRecord, Match, Opportunity } from "@/lib/types";
import { getMatches } from "@/lib/engine";
import { filterMatchesByRadius, type UserLocation } from "@/lib/geo/distance";
import { relatedAnswerIds } from "@/lib/insight/funnel";

export type LastResult = {
  answers: AnswerRecord[];
  matches: Match[];
  pool?: Opportunity[];
  location?: UserLocation;
  radiusExcluded?: number;
  narrowedFrom?: number;
};

export function readLastResult(): LastResult | null {
  try {
    const raw = sessionStorage.getItem("lastResult");
    if (!raw) return null;
    const r = JSON.parse(raw) as LastResult;
    return Array.isArray(r.matches) ? {
      answers: r.answers ?? [],
      matches: r.matches.filter((m) => !m.opportunity.isSample && m.opportunity.origin !== "sample"),
      pool: r.pool?.filter((o) => !o.isSample && o.origin !== "sample"),
      location: r.location,
      radiusExcluded: r.radiusExcluded ?? 0,
      narrowedFrom: r.narrowedFrom,
    } : null;
  } catch {
    return null;
  }
}


/** 답 하나를 "모름"으로 바꿔(조건 완화) 결과를 다시 계산하고 저장한다 */
export function relaxAnswer(r: LastResult, questionId: string): LastResult {
  // 소득·나이처럼 한 번에 여러 기준에 답한 경우 함께 "모름"으로(제안한 만큼 실제로 늘어나게)
  const ids = relatedAnswerIds(r.answers, questionId);
  return [...ids].reduce((acc, id) => setAnswer(acc, id, "unknown"), r);
}

/** 답 하나를 바꿔(조건 고치기) 결과를 다시 계산하고 저장한다 */
export function setAnswer(r: LastResult, questionId: string, answer: Answer): LastResult {
  const answers = r.answers.map((a) => (a.question.id === questionId ? { ...a, answer } : a));
  const filtered = filterMatchesByRadius(getMatches({ pool: r.pool ?? [], answers }), r.location);
  const next = { ...r, answers, matches: filtered.matches, radiusExcluded: filtered.excluded };
  try {
    sessionStorage.setItem("lastResult", JSON.stringify(next));
  } catch {}
  return next;
}
