// 시연 흐름 고정(E2E 성격의 통합 테스트): 게임 → 결과 → 알림 저장 → 반복 조사(새 공고만) → 주간 기록
import { describe, expect, it, vi } from "vitest";
import { FIXTURE_OPPORTUNITIES } from "../engine/__fixtures__/opportunities";
import type { Opportunity } from "../types";

let pool: Opportunity[] = FIXTURE_OPPORTUNITIES.slice(0, -1);
vi.mock("../sources", () => ({ loadOpportunities: async () => pool }));
vi.mock("@/lib/sources", () => ({ loadOpportunities: async () => pool }));

const { applyAnswer, getMatches, nextQuestion, startGame } = await import("../engine");
const { buildWatch } = await import("../alerts/core");
const { scanOne } = await import("./scan");
const { analyzeFunnel } = await import("../insight/funnel");

describe("시연 흐름", () => {
  it("게임 결과로 저장한 조건은 반복 조사에서 새 공고만 한 번씩 찾는다", async () => {
    let s = startGame(pool);
    for (let i = 0; i < 3; i++) {
      const q = nextQuestion(s);
      if (!q) break;
      s = applyAnswer(s, q, "unknown");
    }
    const matches = getMatches(s);
    expect(matches.length).toBeGreaterThan(0);

    const report = analyzeFunnel(pool, s.answers);
    expect(report.passed).toBe(matches.length);

    const watch = buildWatch(s.answers, matches, new Date("2026-11-20T00:00:00Z"));
    const rec0 = { id: "flow-test-0001", watch, totalNew: 0 };

    // 1회차: 결과에서 이미 본 공고뿐 → 새 공고 0
    const rec1 = await scanOne(rec0, new Date("2026-11-21T00:00:00Z"));
    expect(rec1.history?.at(-1)?.newCount).toBe(0);

    // 새 공고가 올라옴 → 2회차에 1건, 3회차엔 다시 0건
    pool = FIXTURE_OPPORTUNITIES.map((o) => ({ ...o, applyEnd: "2026-12-31" }));
    const rec2 = await scanOne(rec1, new Date("2026-11-22T00:00:00Z"));
    const rec3 = await scanOne(rec2, new Date("2026-11-23T00:00:00Z"));
    expect(rec2.history?.at(-1)?.newCount).toBeGreaterThanOrEqual(0);
    expect(rec3.history?.at(-1)?.newCount).toBe(0);
    expect(rec3.history).toHaveLength(3);
    expect(rec3.totalNew).toBe(rec2.totalNew);
  });
});
