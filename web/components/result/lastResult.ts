import type { Answer, AnswerRecord, Match, Opportunity } from "@/lib/types";
import { getMatches, type GameState } from "@/lib/engine";
import { filterMatchesByRadius, type UserLocation } from "@/lib/geo/distance";
import { relatedAnswerIds } from "@/lib/insight/funnel";
import { formalQuestion } from "@/lib/copy";
import { updateAnswers, type AnswerChange } from "@/lib/engine/answer-groups";

export type LastResult = {
  answers: AnswerRecord[];
  matches: Match[];
  pool?: Opportunity[];
  location?: UserLocation;
  radiusExcluded?: number;
  narrowedFrom?: number;
  /** 마지막 답으로 0건이 되어 직전 단계 결과를 보여 줄 때 안내 문구 */
  fallbackNote?: string;
};

export function readLastResult(): LastResult | null {
  try {
    const raw = sessionStorage.getItem("lastResult");
    if (!raw) return null;
    const r = JSON.parse(raw) as LastResult;
    const answers = (r.answers ?? []).map((a) => ({ ...a, question: { ...a.question, text: formalQuestion(a.question.text) } }));
    const pool = r.pool?.filter((o) => !o.isSample && o.origin !== "sample");
    return Array.isArray(r.matches) ? {
      answers,
      matches: pool ? getMatches({pool,answers}) : r.matches.filter((m) => !m.opportunity.isSample && m.opportunity.origin !== "sample"),
      pool,
      location: r.location,
      radiusExcluded: 0,
      narrowedFrom: r.narrowedFrom,
      fallbackNote: r.fallbackNote,
    } : null;
  } catch {
    return null;
  }
}


/** 답 하나를 "모름"으로 바꿔(조건 완화) 결과를 다시 계산하고 저장합니다 */
export function relaxAnswer(r: LastResult, questionId: string): LastResult {
  // 소득·나이처럼 한 번에 여러 기준에 답한 경우 함께 "모름"으로(제안한 만큼 실제로 늘어나게)
  const ids = relatedAnswerIds(r.answers, questionId);
  return [...ids].reduce((acc, id) => setAnswer(acc, id, "unknown"), r);
}

/** 답 하나를 바꿔(조건 고치기) 결과를 다시 계산하고 저장합니다 */
export function setAnswer(r: LastResult, questionId: string, answer: Answer): LastResult {
  return setAnswers(r, [{ id: questionId, answer }]);
}

export function setAnswers(r: LastResult, changes: AnswerChange[]): LastResult {
  const answers = updateAnswers(r.answers, changes);
  const filtered = filterMatchesByRadius(getMatches({ pool: r.pool ?? [], answers }), r.location);
  const next = { ...r, answers, matches: filtered.matches, radiusExcluded: filtered.excluded };
  saveLastResult(next);
  return next;
}

/** 결과 저장. 후보 공고가 수천 건이면 브라우저 저장 한도(약 5MB)를 넘으므로
 *  결과는 후보(pool)+답으로 다시 계산하게 하고 matches는 저장하지 않는다.
 *  그래도 넘치면 결과에 남은 공고만 후보로 줄여 저장한다(결과 화면이 비지 않게). */
export function saveLastResult(r: LastResult): boolean {
  const slim = (pool: Opportunity[]) => pool.map((o) => ({ ...o, fetchedAt: undefined }));
  const tries: Opportunity[][] = r.pool ? [r.pool, r.matches.map((m) => m.opportunity), r.matches.slice(0, 300).map((m) => m.opportunity)] : [];
  for (const pool of tries) {
    try {
      sessionStorage.setItem("lastResult", JSON.stringify({ ...r, matches: [], pool: slim(pool) }));
      return true;
    } catch {
      // 다음(더 작은) 후보로 재시도
    }
  }
  try {
    sessionStorage.setItem("lastResult", JSON.stringify({ ...r, pool: undefined, matches: r.matches.slice(0, 300) }));
    return true;
  } catch {
    return false;
  }
}

/** 결과가 0건으로 끝나지 않게: 마지막 답(들)로 전부 걸러졌다면 공고가 남아 있던 가장 최근 단계를 보여 준다 */
export function nonEmptyResultState(history: GameState[]): { state: GameState; note?: string } {
  const last = history[history.length - 1];
  if (getMatches(last).length) return { state: last };
  for (let i = history.length - 2; i >= 0; i--) {
    const n = getMatches(history[i]).length;
    if (n) return { state: history[i], note: `마지막 답을 적용하면 맞는 공고가 0건이라, 직전 질문까지의 결과 ${n}건을 보여 드립니다.` };
  }
  return { state: last };
}
