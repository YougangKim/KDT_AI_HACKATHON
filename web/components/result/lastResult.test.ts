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

describe("결과 화면이 빈 채로 끝나지 않음", () => {
  const busan = (id: string) => ({ id, title: id, domain: "benefit", region: ["부산"], isSample: false, origin: "api", apply: {}, conditions: [{ attr: "region", op: "in", value: ["부산"], rawText: "부산 거주", confidence: "high" }] });
  it("마지막 답으로 0건이 되면 직전 단계 결과와 안내 문구를 돌려줍니다", async () => {
    const { startGame, applyAnswer, getMatches } = await import("@/lib/engine");
    const { nonEmptyResultState } = await import("./lastResult");
    const s0 = startGame([busan("a"), busan("b")] as never);
    const s1 = applyAnswer(s0, { id: "region:eq:서울", attr: "region", op: "eq", value: "서울", text: "서울에 거주합니까?" } as never, "yes");
    expect(getMatches(s1)).toHaveLength(0);
    const r = nonEmptyResultState([s0, s1]);
    expect(r.state).toBe(s0);
    expect(getMatches(r.state).length).toBe(2);
    expect(r.note).toMatch(/0건이라.*2건/);
  });
  it("공고가 남아 있으면 마지막 단계를 그대로 씁니다", async () => {
    const { startGame } = await import("@/lib/engine");
    const { nonEmptyResultState } = await import("./lastResult");
    const s0 = startGame([busan("a")] as never);
    expect(nonEmptyResultState([s0])).toEqual({ state: s0 });
  });
});

describe("후보가 많아 저장 한도를 넘어도 결과가 남음", () => {
  it("한도를 넘으면 결과 공고만 후보로 줄여 저장하고 다시 읽으면 결과가 보입니다", async () => {
    const { saveLastResult, readLastResult } = await import("./lastResult");
    const store: Record<string, string> = {};
    const LIMIT = 20_000; // 저장 한도 흉내(문자 수)
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { if (v.length > LIMIT) throw new Error("QuotaExceededError"); store[k] = v; },
    });
    const mk = (id: string, region: string) => ({ id, title: id, domain: "benefit", region: [region], isSample: false, origin: "api", apply: {}, summary: "x".repeat(200), conditions: [{ attr: "region", op: "in", value: [region], rawText: `${region} 거주`, confidence: "high" }] });
    const pool = [...Array(300)].map((_, i) => mk(`b${i}`, "부산")).concat([mk("s1", "서울"), mk("s2", "서울")]);
    const answers = [{ question: { id: "region:eq:서울", attr: "region", op: "eq", value: "서울", text: "서울에 거주합니까?" }, answer: "yes" }];
    const matches = pool.filter((o) => o.region[0] === "서울").map((opportunity) => ({ opportunity, status: "eligible", reasons: [] }));
    expect(saveLastResult({ answers, matches, pool } as never)).toBe(true);
    const r = readLastResult();
    expect(r?.matches.map((m) => m.opportunity.id).sort()).toEqual(["s1", "s2"]);
  });
});

describe("채용 공고 범위", () => {
  it("직무 무관 일반 채용을 켜고 끄면 결과에 더해지고 빠집니다", async () => {
    const { setFieldScope } = await import("./lastResult");
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
    const job = (id: string, field: string) => ({ id, title: id, domain: "job", region: [], isSample: false, origin: "api", apply: {}, summary: "", conditions: [{ attr: "field", op: "in", value: [field], rawText: "직무", confidence: "high" }] });
    const pool = [job("it", "정보통신"), job("open", "직무 무관")];
    const q = (v: string) => ({ id: `field:eq:${v}`, attr: "field", op: "eq", value: v, text: "어떤 분야 일을 찾습니까?" });
    const r = { pool, answers: [{ question: q("정보통신"), answer: "yes" }, { question: q("직무 무관"), answer: "no" }], matches: [] } as never;
    const on = setFieldScope(r, "직무 무관", true);
    expect(on.matches.map((m) => m.opportunity.id).sort()).toEqual(["it", "open"]);
    expect(setFieldScope(on, "직무 무관", false).matches.map((m) => m.opportunity.id)).toEqual(["it"]);
  });
});
