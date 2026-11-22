import { describe, expect, it } from "vitest";
import type { Match, Opportunity } from "../types";
import { explainMatch, parseConditionsJson, phraseQuestion, structureConditions } from "./index";
import { normalizeRegion, structureConditionsRules } from "./rules";

describe("structureConditionsRules", () => {
  it("나이 범위·소득·무주택·독립", () => {
    const c = structureConditionsRules("만 19세 ~ 34세 무주택 청년으로 부모와 별도 거주, 기준중위소득 60% 이하");
    expect(c).toContainEqual(expect.objectContaining({ attr: "age", op: "gte", value: 19, confidence: "high" }));
    expect(c).toContainEqual(expect.objectContaining({ attr: "age", op: "lte", value: 34 }));
    expect(c).toContainEqual(expect.objectContaining({ attr: "incomePct", op: "lte", value: 60, confidence: "high" }));
    expect(c).toContainEqual(expect.objectContaining({ attr: "homeless", value: true }));
    expect(c).toContainEqual(expect.objectContaining({ attr: "livingAlone", value: true }));
  });
  it("'이상 ~ 미만' 표현", () => {
    const c = structureConditionsRules("만 19세 이상 30세 미만");
    expect(c.filter((x) => x.attr === "age").map((x) => x.value)).toEqual([19, 29]);
  });
  it("상한만", () => {
    expect(structureConditionsRules("만 34세 이하 미취업자")).toEqual(
      expect.arrayContaining([expect.objectContaining({ attr: "age", op: "lte", value: 34 }), expect.objectContaining({ attr: "employment", value: ["jobseeker"] })]),
    );
  });
  it("지역", () => {
    expect(structureConditionsRules("서울특별시 거주 청년")).toContainEqual(expect.objectContaining({ attr: "region", value: ["서울"] }));
    expect(normalizeRegion("경상남도 창원시")).toBe("경남");
  });
  it("빈 문장", () => {
    expect(structureConditionsRules("  ")).toEqual([]);
  });
});

describe("parseConditionsJson", () => {
  it("코드블록 속 JSON, 잘못된 attr 제거", () => {
    const text = '```json\n[{"attr":"age","op":"lte","value":34,"rawText":"만 34세 이하","confidence":"high"},{"attr":"degree","op":"eq","value":"대졸","rawText":"x","confidence":"high"}]\n```';
    expect(parseConditionsJson(text)).toEqual([{ attr: "age", op: "lte", value: 34, rawText: "만 34세 이하", confidence: "high" }]);
  });
  it("JSON 아니면 null", () => {
    expect(parseConditionsJson("모르겠어요")).toBeNull();
  });
});

describe("키 없이 규칙 기반 폴백", () => {
  delete process.env.ANTHROPIC_API_KEY;
  it("structureConditions", async () => {
    expect(await structureConditions("만 19세 이상 39세 이하 무주택자")).toHaveLength(3);
  });
  it("phraseQuestion", async () => {
    expect(await phraseQuestion({ attr: "age", op: "lte", value: 34 })).toBe("만 34세 이하인가요?");
    expect(await phraseQuestion({ attr: "region", op: "in", value: ["서울", "경기"] })).toBe("서울·경기 중 한 곳에 살고 있나요?");
    expect(await phraseQuestion({ attr: "interest", op: "eq", value: "housing" })).toContain("주택");
  });
  it("explainMatch", async () => {
    const o = { title: "청년월세 지원", org: "국토교통부", applyEnd: "2026-12-31" } as Opportunity;
    const m: Match = { opportunity: o, status: "needs_check", reasons: ["만 34세 이하", "무주택"], unknowns: [{ attr: "incomePct", op: "lte", value: 60, rawText: "기준중위소득 60% 이하", confidence: "high" }] };
    const s = await explainMatch(m);
    expect(s).toContain("청년월세 지원");
    expect(s).toContain("2026-12-31");
    expect(s).toContain("기준중위소득 60% 이하");
  });
});

describe("나이 범위 미만", () => {
  it("'만 18세 ~ 40세 미만'은 39세까지", () => {
    expect(structureConditionsRules("만 18세 ~ 40세 미만 청년").filter((c) => c.attr === "age").map((c) => c.value)).toEqual([18, 39]);
  });
});
