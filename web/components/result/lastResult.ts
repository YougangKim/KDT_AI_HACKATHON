import type { Answer, AnswerRecord, Match, Opportunity } from "@/lib/types";
import { getMatches } from "@/lib/engine";

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


/** 답 하나를 "모름"으로 바꿔(조건 완화) 결과를 다시 계산하고 저장한다 */
export function relaxAnswer(r: LastResult, questionId: string): LastResult {
  return setAnswer(r, questionId, "unknown");
}

/** 답 하나를 바꿔(조건 고치기) 결과를 다시 계산하고 저장한다 */
export function setAnswer(r: LastResult, questionId: string, answer: Answer): LastResult {
  const answers = r.answers.map((a) => (a.question.id === questionId ? { ...a, answer } : a));
  const next = { answers, matches: getMatches({ pool: r.pool ?? [], answers }), pool: r.pool };
  try {
    sessionStorage.setItem("lastResult", JSON.stringify(next));
  } catch {}
  return next;
}
