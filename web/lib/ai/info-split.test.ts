import { describe, expect, it } from "vitest";
import { expectedInfo, ruleRefinement } from "./refinement-rules";
import { validateRefinement } from "./refinement";
import { rankQuestions, splitInfo, startGame } from "../engine";
import type { Domain, Opportunity } from "../types";

const opp = (id: string, domain: Domain, title: string): Opportunity => ({ id, domain, title, summary: "", org: "기관", region: [], conditions: [], url: "https://example.org", source: "fixture", isSample: false, fetchedAt: "2026-11-25" });
// 채용 4건 / 지원금 174건으로 쏠린 후보
const skewed = [
  ...["정규직", "정규직", "계약직", "인턴"].map((t, i) => opp(`j${i}`, "job", `${t} 채용`)),
  ...Array.from({ length: 174 }, (_, i) => opp(`b${i}`, "benefit", i % 2 ? "청년 월세 지원" : "자격증 응시료 교육 지원")),
];

describe("정보량 기준 질문 선정", () => {
  it("정보량: 고르게 가를수록 크고, 작은 분야만 가르면 작다", () => {
    expect(splitInfo(100, 50, 50)).toBeCloseTo(1, 5);
    expect(expectedInfo(178, [2, 1, 1], 174)).toBeLessThan(0.05);
    expect(expectedInfo(178, [87, 87], 4)).toBeGreaterThan(0.9);
  });

  it("후보가 몰린 분야(지원금) 안을 나누는 축을 고른다", () => {
    const r = ruleRefinement(skewed, []);
    expect(r?.facet).toBe("need");
  });

  it("작은 분야만 가르는 AI 질문은 거부한다", () => {
    const evidence = skewed.map((o) => ({ id: o.id, title: o.title, summary: o.summary, domain: o.domain }));
    const jobOnly = { text: "어떤 고용 형태를 원하십니까?", why: "채용 공고를 고용 형태로 나눕니다.", options: [{ label: "정규직", terms: ["정규직"] }, { label: "계약직", terms: ["계약직"] }] };
    expect(validateRefinement(jobOnly, evidence, [])).toBeNull();
    const big = { text: "지금 가장 필요한 도움은 무엇입니까?", why: "지원 정책을 도움 종류로 나눕니다.", options: [{ label: "주거비", terms: ["월세"] }, { label: "교육·자격증", terms: ["자격증"] }] };
    expect(validateRefinement(big, evidence, [])).not.toBeNull();
  });

  it("한 분야가 80%를 넘으면 첫 질문으로 관심 분야를 우선하지 않는다", () => {
    const pool = skewed.map((o) => o.domain === "benefit" ? { ...o, conditions: [{ attr: "homeless" as const, op: "eq" as const, value: true, rawText: "무주택", confidence: "high" as const }] } : o).map((o, i) => i % 2 && o.domain === "benefit" ? { ...o, conditions: [] } : o);
    const top = rankQuestions(startGame(pool), 1)[0];
    expect(top?.question.attr).not.toBe("interest");
  });
});

describe("모델 입력 표본", () => {
  it("같은 제목이 반복돼도 큰 분야 표본 수를 채운다", async () => {
    const { refinementContext } = await import("./refinement");
    const ev = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `j${i}`, title: `채용 ${i}`, summary: "", domain: "job" })),
      ...Array.from({ length: 174 }, (_, i) => ({ id: `b${i}`, title: i < 100 ? "청년 월세 지원" : `지원 ${i}`, summary: "", domain: "benefit" })),
    ];
    const ctx = refinementContext(ev, []);
    expect(ctx.focus).toBe("benefit");
    expect(ctx.evidence.filter((e) => e.domain === "benefit").length).toBe(Math.round(16 * 174 / 178));
    expect(ctx.evidence.filter((e) => e.domain === "job").length).toBe(1);
  });
});
