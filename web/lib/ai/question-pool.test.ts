import { describe, expect, it } from "vitest";
import {
  generatedQuestionKey,
  isPromoted,
} from "./question-pool";

describe("질문 승격", () => {
  it("모든 임계값을 만족해야 승격합니다", () => {
    expect(isPromoted({
      shown: 200,
      answered: 130,
      unknown: 50,
      skipped: 40,
      undo: 24,
      reductionSum: 50,
    })).toBe(true);
    expect(isPromoted({
      shown: 199,
      answered: 199,
      unknown: 0,
      skipped: 0,
      undo: 0,
      reductionSum: 199,
    })).toBe(false);
  });

  it("표시 문장이 달라도 필터 축과 매핑이 같으면 키가 같습니다", () => {
    const base = {
      id: "need:eq:교육",
      why: "후보를 구분합니다.",
      options: [{ key: "0", label: "교육비" }, { key: "1", label: "생활비" }],
    };
    expect(generatedQuestionKey({ ...base, text: "어떤 지원이 필요합니까?" }))
      .toBe(generatedQuestionKey({
        ...base,
        text: "원하는 지원은 무엇입니까?",
        options: [...base.options].reverse(),
      }));
  });
});
