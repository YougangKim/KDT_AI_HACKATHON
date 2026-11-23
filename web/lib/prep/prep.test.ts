import { describe, expect, it } from "vitest";
import { ruleBasedPlan } from "./index";

const match = (domain: string, extra: Record<string, unknown> = {}) => ({
  opportunity: { id: "x", title: "청년 월세 지원", org: "서울시", domain, region: [], summary: "주민등록등본과 임대차계약서 사본을 제출합니다.", conditions: [{ attr: "age", op: "lte", value: 39, rawText: "만 39세 이하", confidence: "high" }], applyEnd: "2026-12-31", apply: { how: "온라인 신청", where: "복지로" }, url: "https://example.org", source: "t", isSample: false, fetchedAt: "" , ...extra },
  status: "needs_check", reasons: ["만 39세 이하 → 예"], unknowns: [{ attr: "incomePct", op: "lte", value: 60, rawText: "기준중위소득 60% 이하", confidence: "high" }],
}) as never;

describe("신청 준비 계획(규칙)", () => {
  it("공고 문구의 서류와 분야 기본 서류, 맞는 점·확인할 점, 마감 일정을 정리합니다", () => {
    const p = ruleBasedPlan(match("benefit"), [], new Date("2026-11-23"));
    expect(p.docs).toContain("임대차계약서 사본");
    expect(p.docs).toContain("통장 사본");
    expect(p.fit).toEqual(["만 39세 이하 → 예"]);
    expect(p.check).toEqual(["기준중위소득 60% 이하"]);
    expect(p.steps.join(" ")).toMatch(/복지로에서 온라인 신청/);
    expect(p.steps.join(" ")).toMatch(/2026-12-31/);
    expect(p.drafts[0].title).toBe("신청 사유(초안)");
  });
  it("채용 공고는 지원 동기 초안을 만들고 개인정보를 넣지 않습니다", () => {
    const p = ruleBasedPlan(match("job"), [], new Date("2026-11-23"));
    expect(p.drafts[0].title).toBe("지원 동기(초안)");
    expect(p.drafts[0].body).not.toMatch(/\d{6}-\d{7}|010-/);
  });
});
