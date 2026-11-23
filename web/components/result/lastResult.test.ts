import { afterEach, describe, expect, it, vi } from "vitest";
import { readLastResult } from "./lastResult";

afterEach(() => vi.unstubAllGlobals());

describe("실제 공고 결과만 복원", () => {
  it("demo 파라미터로 가상 결과를 생성하지 않는다", () => {
    vi.stubGlobal("location", { search: "?demo=1" });
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    expect(readLastResult()).toBeNull();
  });

  it("기존 세션의 샘플을 결과와 후보에서 제외합니다", () => {
    const pool = [
      { id: "live", isSample: false, origin: "api", domain: "benefit", conditions: [], region: [] },
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
  it("이전 지역 필터로 비어 있던 저장 결과를 원래 후보에서 복원합니다", () => {
    const pool = [{id:"remote-online",domain:"benefit",conditions:[],region:["부산"],isSample:false,apply:{how:"온라인 신청"}}];
    vi.stubGlobal("sessionStorage", {getItem:()=>JSON.stringify({pool,matches:[],radiusExcluded:1,answers:[{question:{id:"region:eq:서울",attr:"region",op:"eq",value:"서울",text:"서울에 거주합니까?"},answer:"yes"}]})});
    // 반경 필터 기록은 지우고 다시 판정한다: 서울 거주 답이면 부산 공고는 빠진다
    expect(readLastResult()).toMatchObject({radiusExcluded:0,matches:[]});
  });
});
