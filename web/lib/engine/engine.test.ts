import { describe, expect, it } from "vitest";
import type { Condition, Opportunity, Question } from "../types";
import { applyAnswer, getMatches, nextQuestion, remaining, startGame } from "./index";
import { FIXTURE_OPPORTUNITIES } from "./__fixtures__/opportunities";

const cond = (attr: Condition["attr"], op: Condition["op"], value: Condition["value"]): Condition => ({
  attr,
  op,
  value,
  rawText: `${attr} ${op} ${value}`,
  confidence: "high",
});
const opp = (id: string, conditions: Condition[], region: string[] = []): Opportunity => ({
  id,
  domain: "benefit",
  title: id,
  org: "t",
  region,
  summary: "",
  conditions,
  url: "https://example.com",
  source: "test",
  isSample: true,
  fetchedAt: "2026-11-21",
});
const q = (attr: Condition["attr"], op: Condition["op"], value: Condition["value"]): Question => ({
  id: `${attr}:${op}:${String(value)}`,
  attr,
  op,
  value,
  text: "",
});

describe("후보 축소", () => {
  it("아니오 답은 그 조건이 필요한 후보를 지운다", () => {
    const s = startGame([opp("a", [cond("homeless", "eq", true)]), opp("b", [])]);
    const after = applyAnswer(s, q("homeless", "eq", true), "no");
    expect(remaining(s)).toBe(2);
    expect(remaining(after)).toBe(1);
    expect(getMatches(after).map((m) => m.opportunity.id)).toEqual(["b"]);
  });

  it("숫자 조건은 함의로 판정한다(만 34세 이하=예 → 39세 이하 통과, 35세 이상 탈락)", () => {
    const pool = [opp("u39", [cond("age", "lte", 39)]), opp("o35", [cond("age", "gte", 35)])];
    const s = applyAnswer(startGame(pool), q("age", "lte", 34), "yes");
    const m = getMatches(s);
    expect(m.map((x) => x.opportunity.id)).toEqual(["u39"]);
    expect(m[0].status).toBe("eligible");
  });

  it("지역: 서울=예면 경기 대상 공고는 탈락, 전국 공고는 남는다", () => {
    const pool = [opp("seoul", [], ["서울"]), opp("gg", [], ["경기"]), opp("all", [])];
    const s = applyAnswer(startGame(pool), q("region", "eq", "서울"), "yes");
    expect(getMatches(s).map((m) => m.opportunity.id).sort()).toEqual(["all", "seoul"]);
  });

  it("질문은 남은 후보를 반반에 가깝게 나누는 쪽을 고른다", () => {
    const pool = [
      opp("1", [cond("homeless", "eq", true)]),
      opp("2", [cond("homeless", "eq", true)]),
      opp("3", [cond("livingAlone", "eq", true)]),
      opp("4", []),
    ];
    expect(nextQuestion(startGame(pool))?.attr).toBe("homeless");
  });

  it("직무 분야를 묻기 전에는 경력·학력·취업 상태를 묻지 않는다", () => {
    const pool = [
      {
        ...opp("experienced", [
          cond("field", "eq", "경영·회계·사무"),
          cond("experienced", "eq", true),
          cond("education", "gte", 3),
        ]),
        domain: "job" as const,
      },
      { ...opp("other", [cond("field", "eq", "정보통신")]), domain: "job" as const },
    ];
    let state = startGame(pool);
    state = applyAnswer(state, q("interest", "eq", "job"), "yes");
    expect(nextQuestion(state)?.attr).toBe("field");
  });

  it("같은 질문은 다시 묻지 않고, 매 답마다 후보가 늘지 않는다", () => {
    let s = startGame(FIXTURE_OPPORTUNITIES);
    const ids = new Set<string>();
    let prev = remaining(s);
    for (let i = 0; i < 20; i++) {
      const next = nextQuestion(s);
      if (!next) break;
      expect(ids.has(next.id)).toBe(false);
      ids.add(next.id);
      s = applyAnswer(s, next, i % 2 ? "no" : "yes");
      expect(remaining(s)).toBeLessThanOrEqual(prev);
      prev = remaining(s);
    }
    expect(ids.size).toBeGreaterThan(2);
  });
});

describe("모름 처리", () => {
  it("모름은 후보를 지우지 않고 needs_check + unknowns로 남긴다", () => {
    const income = cond("incomePct", "lte", 100);
    const s = applyAnswer(startGame([opp("a", [income])]), q("incomePct", "lte", 100), "unknown");
    expect(remaining(s)).toBe(1);
    const [m] = getMatches(s);
    expect(m.status).toBe("needs_check");
    expect(m.unknowns).toEqual([income]);
  });

  it("신뢰도 low 조건은 통과해도 확인 필요", () => {
    const low = { ...cond("homeless", "eq", true), confidence: "low" as const };
    const s = applyAnswer(startGame([opp("a", [low])]), q("homeless", "eq", true), "yes");
    expect(getMatches(s)[0].status).toBe("needs_check");
  });

  it("모름으로 답한 질문은 다시 나오지 않는다", () => {
    const s = applyAnswer(startGame([opp("a", [cond("homeless", "eq", true)]), opp("b", [])]), q("homeless", "eq", true), "unknown");
    expect(nextQuestion(s)?.id).not.toBe("homeless:eq:true");
  });
});

describe("질문 고갈", () => {
  it("조건이 없는 후보뿐이면 null", () => {
    const s = startGame([opp("a", []), opp("b", [])].map((o) => ({ ...o, domain: "exam" as const })));
    // 관심 분야 질문 하나뿐: 답하면 고갈
    const first = nextQuestion(s);
    expect(first?.attr).toBe("interest");
    expect(nextQuestion(applyAnswer(s, first!, "yes"))).toBeNull();
  });

  it("후보가 0개면 null", () => {
    const s = applyAnswer(startGame([opp("a", [cond("homeless", "eq", true)])]), q("homeless", "eq", true), "no");
    expect(remaining(s)).toBe(0);
    expect(nextQuestion(s)).toBeNull();
  });
});
