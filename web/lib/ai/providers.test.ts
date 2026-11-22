import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetClient, aiEnabled, structureConditions } from "./index";
import { judgeYes } from "./jev";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); _resetClient(); });

describe("Gemini 경로", () => {
  it("Claude 키가 없고 Gemini 키가 있으면 Gemini로 구조화한다", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    _resetClient();
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[{"attr":"age","op":"lte","value":34,"rawText":"만 34세 이하","confidence":"high"}]' }] } }] })));
    vi.stubGlobal("fetch", f);
    expect(aiEnabled()).toBe(true);
    const c = await structureConditions("만 34세 이하 청년");
    expect(c).toEqual([expect.objectContaining({ attr: "age", value: 34 })]);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("generateContent");
  });
  it("Gemini가 실패하면 규칙 기반으로 폴백", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    _resetClient();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await structureConditions("만 34세 이하 무주택")).toContainEqual(expect.objectContaining({ attr: "homeless" }));
  });
});

describe("Jev 판단", () => {
  it("키 없으면 호출하지 않고 null", async () => {
    vi.stubEnv("JEV_API_KEY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await judgeYes("s", { a: "q" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("noul 확률을 이름별로 돌려준다", async () => {
    vi.stubEnv("JEV_API_KEY", "j");
    const f = vi.fn(async () => new Response(JSON.stringify({ model: "jev-1.14.0", answers: { a: { type: "noul", noul: 0.9 }, b: { type: "noul", noul: 0.1 } } })));
    vi.stubGlobal("fetch", f);
    expect(await judgeYes("s", { a: "q1", b: "q2" })).toEqual({ a: 0.9, b: 0.1 });
    const body = JSON.parse(String(((f.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(body.questions.a).toEqual({ type: "noul", instructions: "q1" });
  });
});

describe("AI 조건 안전장치", () => {
  it("정년·0세·기관명 지명·무주택 근거 없는 조건은 버린다", async () => {
    const { plausibleAiCondition } = await import("../sources");
    const c = (attr: string, op: string, value: unknown, rawText: string) => ({ attr, op, value, rawText, confidence: "high" }) as never;
    expect(plausibleAiCondition(c("age", "lte", 59, "정년 만 60세 미만"))).toBe(false);
    expect(plausibleAiCondition(c("age", "gte", 0, "만 60세 미만"))).toBe(false);
    expect(plausibleAiCondition(c("region", "in", ["세종"], "세종학당재단"))).toBe(false);
    expect(plausibleAiCondition(c("homeless", "eq", true, "자립준비청년"))).toBe(false);
    expect(plausibleAiCondition(c("age", "lte", 34, "만 34세 이하"))).toBe(true);
    expect(plausibleAiCondition(c("region", "in", ["서울"], "서울시 거주"))).toBe(true);
  });
});
