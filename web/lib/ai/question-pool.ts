import { createHash } from "node:crypto";
import { stableJson } from "./cache";
import type { GeneratedQuestion, QuestionFacet } from "./question-contract";
import type { Refinement } from "./refinement";

export const PROMOTION_THRESHOLDS = {
  // 실측 전 보수적으로 시작하는 추정 초기값입니다.
  minimumShown: 200,
  answerRate: 0.65,
  unknownRate: 0.25,
  skippedRate: 0.20,
  undoRate: 0.12,
  averageReductionRate: 0.25,
} as const;

export interface FeedbackCounts {
  shown: number;
  answered: number;
  unknown: number;
  skipped: number;
  undo: number;
  reductionSum: number;
}

export function isPromoted(counts: FeedbackCounts): boolean {
  if (counts.shown < PROMOTION_THRESHOLDS.minimumShown) return false;
  const rate = (value: number) => value / counts.shown;
  return rate(counts.answered) >= PROMOTION_THRESHOLDS.answerRate &&
    rate(counts.unknown) <= PROMOTION_THRESHOLDS.unknownRate &&
    rate(counts.skipped) <= PROMOTION_THRESHOLDS.skippedRate &&
    rate(counts.undo) <= PROMOTION_THRESHOLDS.undoRate &&
    counts.reductionSum / counts.shown >= PROMOTION_THRESHOLDS.averageReductionRate;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 24);
}

/** 표시 문장은 제외하고 필터 축과 선택지→필터 매핑만 키로 사용합니다. */
export function generatedQuestionKey(question: GeneratedQuestion): string {
  return digest({
    kind: "generated",
    facet: question.id,
    options: question.options
      .map(({ key }) => key)
      .sort(),
  });
}

export function refinementQuestionKey(question: Refinement): string {
  return digest({
    kind: "refinement",
    options: question.options
      .map((option) => ({
        label: option.label,
        ids: [...option.ids].sort(),
        terms: [...(option.terms ?? [])].sort(),
      }))
      .sort((a, b) => stableJson(a).localeCompare(stableJson(b))),
  });
}

export function facetPoolKey(facets: QuestionFacet[]): string {
  return digest(facets.map((facet) => ({
    id: facet.id,
    keys: facet.options.map((option) => option.key).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id)));
}

export function refinementPoolKey(ids: string[]): string {
  return digest([...ids].sort());
}
