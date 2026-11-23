import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _clearQuestionFeedbackMemory,
  allowQuestionFeedback,
  getPromotedQuestion,
  recordQuestionFeedback,
  saveQuestionDefinition,
} from "./question-feedback";

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  _clearQuestionFeedbackMemory();
});

describe("질문 피드백 저장", () => {
  it("IP별 분당 요청 수를 제한합니다", () => {
    for (let index = 0; index < 30; index++) expect(allowQuestionFeedback("ip", 1)).toBe(true);
    expect(allowQuestionFeedback("ip", 1)).toBe(false);
  });

  it("임계값을 충족한 질문을 풀에서 조회합니다", async () => {
    await saveQuestionDefinition("0123456789abcdef01234567", "pool", { text: "질문" });
    for (let index = 0; index < 200; index++) {
      await recordQuestionFeedback({
        key: "0123456789abcdef01234567",
        type: index < 130 ? "answered" : "shown",
        before: 100,
        after: 70,
      });
    }
    expect(await getPromotedQuestion("pool")).toEqual({ text: "질문" });
  });
});
