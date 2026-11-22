import { describe, expect, it } from "vitest";
import { chipOf } from "../../components/result/AnalysisView";
import type { AnswerRecord } from "../types";

const rec = (attr: AnswerRecord["question"]["attr"], op: AnswerRecord["question"]["op"], value: AnswerRecord["question"]["value"], answer: AnswerRecord["answer"]): AnswerRecord => ({
  question: { id: "x", attr, op, value, text: "" },
  answer,
});

describe("분석 화면 조건 칩", () => {
  it("답을 짧은 단답형으로 바꾼다", () => {
    expect(chipOf(rec("age", "lte", 34, "yes"))).toBe("34세↓");
    expect(chipOf(rec("region", "eq", "부산", "no"))).toBe("📍부산 ✕");
    expect(chipOf(rec("homeless", "eq", true, "yes"))).toBe("무주택");
    expect(chipOf(rec("employment", "eq", "employed", "no"))).toBe("재직 ✕");
    expect(chipOf(rec("incomePct", "lte", 150, "yes"))).toBe("소득 150%↓");
    expect(chipOf(rec("age", "lte", 34, "unknown"))).toBeNull();
  });
});
