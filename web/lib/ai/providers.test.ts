import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetClient, aiEnabled, structureConditions } from "./index";
import { judgeYes } from "./jev";
import { aiProviderStatus, chat } from "./providers";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); _resetClient(); });

describe("Gemini 경로", () => {
  it("Claude 키가 없고 Gemini 키가 있으면 Gemini로 구조화합니다", async () => {
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

describe("무료 LLM 폴백 체인", () => {
  it("사용 가능한 Groq 기본 모델과 낮은 추론량을 사용합니다", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq");
    vi.stubEnv("GROQ_MODEL", "");
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:"ok"}}]})));
    vi.stubGlobal("fetch", f);
    expect(await chat("system", "user", 1800)).toBe("ok");
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({model:"openai/gpt-oss-120b",reasoning_effort:"low",max_tokens:1800});
  });
  it("공급자 usage를 누적합니다", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq");
    vi.stubEnv("GEMINI_API_KEY", "");
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 12, completion_tokens: 7 },
    })));
    vi.stubGlobal("fetch", f);
    await chat("system", "user", 100);
    expect(aiProviderStatus().groq)
      .toMatchObject({ promptTokens: 12, completionTokens: 7, totalTokens: 19 });
  });
  it("첫 공급자가 429면 다음 공급자로 넘어간다", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq");
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("limited", {
        status: 429,
        headers: { "Retry-After": "60" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "ok" } }],
      })));
    vi.stubGlobal("fetch", fetchMock);

    expect(await chat("system", "user", 100)).toBe("ok");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("groq.com");
    expect(String(fetchMock.mock.calls[1][0])).toContain("openrouter.ai");
  });

  it("쿨다운 중인 공급자를 건너뛴다", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq");
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockImplementation(async () => new Response(JSON.stringify({
        choices: [{ message: { content: "fallback" } }],
      })));
    vi.stubGlobal("fetch", fetchMock);

    await chat("system", "first", 100);
    fetchMock.mockClear();
    expect(await chat("system", "second", 100)).toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("openrouter.ai");
  });

  it("키가 없는 공급자는 호출하지 않는다", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter");
    vi.stubEnv("CF_ACCOUNT_ID", "");
    vi.stubEnv("CF_API_TOKEN", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "ok" } }],
    })));
    vi.stubGlobal("fetch", fetchMock);

    expect(await chat("system", "user", 100)).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("openrouter.ai");
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

describe("Gemini 다음 질문 선택", () => {
  const cands = [
    { id: "region:eq:서울", text: "지금 어디에 살고 있습니까?", yes: 40, no: 300, resolve: 0 },
    { id: "homeless:eq:true", text: "본인 명의 집이 없습니까?", yes: 200, no: 150, resolve: 30 },
  ];
  it("후보 중 Gemini가 고른 id를 돌려주고, 요청에 후보·답한 내용만 보낸다", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    _resetClient();
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"id":"homeless:eq:true","why":"균형"}' }] } }] })));
    vi.stubGlobal("fetch", f);
    const { pickNextQuestion } = await import("./index");
    expect(await pickNextQuestion(cands, [{ text: "청년 주택 정보가 필요합니까?", answer: "yes" }], 340)).toBe("homeless:eq:true");
    const body = String(((f.mock.calls[0] as unknown[])[1] as { body: string }).body);
    expect(body).toContain("homeless:eq:true");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("generateContent");
  });
  it("후보에 없는 id나 오류면 null(화면은 규칙 1순위)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    _resetClient();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"id":"made-up"}' }] } }] }))));
    const { pickNextQuestion } = await import("./index");
    expect(await pickNextQuestion(cands, [], 340)).toBeNull();
  });
});
