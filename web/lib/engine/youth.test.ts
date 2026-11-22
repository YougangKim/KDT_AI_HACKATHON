import { describe, expect, it } from "vitest";
import { getMatches } from "./index";
import type { Opportunity, Question } from "../types";

const opp = (conditions: Opportunity["conditions"]): Opportunity => ({
  id: "o", domain: "job", title: "t", org: "o", region: [], summary: "", conditions,
  url: "https://x", source: "s", isSample: true, fetchedAt: "",
});
const q = (attr: Question["attr"], op: Question["op"], value: Question["value"]): Question => ({
  id: `${attr}:${op}:${String(value)}`, attr, op, value, text: "",
});

describe("청년 기본 지식", () => {
  it("만 19세 이상 조건은 묻지 않아도 통과(서비스 대상이 19~34세)", () => {
    const m = getMatches({ pool: [opp([{ attr: "age", op: "gte", value: 19, rawText: "만 19세 이상", confidence: "high" }])], answers: [] });
    expect(m[0].status).toBe("eligible");
  });
  it("직장인·알바 모두 아니오면 '구직자 또는 학생' 조건은 통과", () => {
    const m = getMatches({
      pool: [opp([{ attr: "employment", op: "in", value: ["jobseeker", "student"], rawText: "미취업 청년", confidence: "high" }])],
      answers: [
        { question: q("employment", "eq", "employed"), answer: "no" },
        { question: q("employment", "eq", "parttime"), answer: "no" },
      ],
    });
    expect(m[0].status).toBe("eligible");
  });
});

describe("취업 상태는 바뀔 수 있어 탈락시키지 않는다", () => {
  it("알바 중이라고 답해도 미취업자 대상 공고는 '확인 필요'로 남는다", () => {
    const ms = getMatches({
      pool: [opp([{ attr: "employment", op: "in", value: ["jobseeker", "student"], rawText: "미취업 청년", confidence: "high" }])],
      answers: [{ question: q("employment", "eq", "parttime"), answer: "yes" }],
    });
    expect(ms).toHaveLength(1);
    expect(ms[0].status).toBe("needs_check");
  });
});

describe("근거 없는 탈락 방지", () => {
  const no = (attr: Question["attr"], op: Question["op"], value: Question["value"]) => ({ question: q(attr, op, value), answer: "no" as const });
  it("'우대' 나이 조건은 넘어도 남는다", () => {
    const ms = getMatches({ pool: [opp([{ attr: "age", op: "lte", value: 34, rawText: "만 34세 이하 청년 우대", confidence: "high" }])], answers: [no("age", "lte", 34)] });
    expect(ms[0]?.status).toBe("needs_check");
  });
  it("기준중위소득이 아닌 소득 기준은 중위소득 답으로 탈락시키지 않는다", () => {
    const ms = getMatches({ pool: [opp([{ attr: "incomePct", op: "lte", value: 100, rawText: "월평균소득 100% 이하", confidence: "high" }])], answers: [no("incomePct", "lte", 100)] });
    expect(ms[0]?.status).toBe("needs_check");
  });
  it("기준중위소득·지역·무주택 같은 실제 요건은 그대로 탈락", () => {
    const pool = [
      opp([{ attr: "incomePct", op: "lte", value: 150, rawText: "기준중위소득 150% 이하", confidence: "high" }]),
      opp([{ attr: "homeless", op: "eq", value: true, rawText: "무주택자", confidence: "high" }]),
    ];
    expect(getMatches({ pool: [pool[0]], answers: [no("incomePct", "lte", 150)] })).toHaveLength(0);
    expect(getMatches({ pool: [pool[1]], answers: [no("homeless", "eq", true)] })).toHaveLength(0);
  });
});
