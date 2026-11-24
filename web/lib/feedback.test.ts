import { describe, expect, it } from "vitest";
import { parseFeedback, shouldAsk, summarize } from "./feedback";

describe("parseFeedback", () => {
  it("필수 문항(1·2·4번)이 없으면 거부", () => {
    expect(parseFeedback({ ease: 4, fit: 3 })).toBeNull();
    expect(parseFeedback({ ease: 6, fit: 3, reuse: "예" })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
  });
  it("허용 값만 남기고 길이를 자른다", () => {
    const f = parseFeedback({ ease: 4, fit: 3, reuse: "예", screen: "엉뚱", comment: "가".repeat(400), path: "/result", ref: "open chat!", ip: "1.2.3.4" });
    expect(f).toEqual({ ease: 4, fit: 3, reuse: "예", comment: "가".repeat(300), path: "/result", ref: "openchat" });
  });
});

describe("shouldAsk", () => {
  const now = Date.UTC(2026, 10, 24);
  it("처음이면 묻고, 제출했으면 다시 묻지 않는다", () => {
    expect(shouldAsk(null, now)).toBe(true);
    expect(shouldAsk({ done: true }, now)).toBe(false);
  });
  it("다음에 → 7일 동안 묻지 않음", () => {
    expect(shouldAsk({ snoozedAt: now - 6 * 864e5 }, now)).toBe(false);
    expect(shouldAsk({ snoozedAt: now - 7 * 864e5 }, now)).toBe(true);
  });
});

describe("summarize", () => {
  it("평균과 분포를 낸다", () => {
    const s = summarize([
      { ease: 4, fit: 3, reuse: "예", screen: "질문" },
      { ease: 5, fit: 4, reuse: "예", ref: "openchat" },
    ]);
    expect(s).toEqual({ count: 2, easeAvg: 4.5, fitAvg: 3.5, reuse: { 예: 2 }, screen: { 질문: 1 }, ref: { openchat: 1 } });
    expect(summarize([]).easeAvg).toBe(0);
  });
});
