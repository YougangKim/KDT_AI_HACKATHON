import { afterEach, describe, expect, it, vi } from "vitest";
import { readLastResult } from "./lastResult";

afterEach(() => vi.unstubAllGlobals());

describe("실제 공고 결과만 복원", () => {
  it("demo 파라미터로 가상 결과를 생성하지 않는다", () => {
    vi.stubGlobal("location", { search: "?demo=1" });
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    expect(readLastResult()).toBeNull();
  });

  it("기존 세션의 샘플을 결과와 후보에서 제외한다", () => {
    const pool = [
      { id: "live", isSample: false, origin: "api" },
      { id: "old", isSample: true },
      { id: "old-origin", isSample: false, origin: "sample" },
    ];
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify({
      answers: [], pool, matches: pool.map((opportunity) => ({ opportunity })),
    }) });
    const result = readLastResult();
    expect(result?.pool?.map((o) => o.id)).toEqual(["live"]);
    expect(result?.matches.map((m) => m.opportunity.id)).toEqual(["live"]);
  });
});
