import { afterEach, describe, expect, it } from "vitest";
import { searchWeb, toOpportunity, webSearchProvider } from "./websearch";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("웹 검색 보충(선택 기능)", () => {
  it("기본값은 꺼져 있어 키가 있어도 호출하지 않는다", async () => {
    delete process.env.WEB_SEARCH_ENABLED;
    process.env.TAVILY_API_KEY = "x";
    expect(webSearchProvider()).toBeNull();
    expect(await searchWeb(["housing"])).toEqual([]);
  });
  it("켜고 키가 있을 때만 제공자를 고른다(Tavily 우선)", () => {
    process.env.WEB_SEARCH_ENABLED = "1";
    delete process.env.TAVILY_API_KEY;
    process.env.EXA_API_KEY = "y";
    expect(webSearchProvider()).toBe("exa");
    process.env.TAVILY_API_KEY = "x";
    expect(webSearchProvider()).toBe("tavily");
  });
  it("결과는 제목·링크·짧은 요약만 남기고 웹 검색 결과로 표시한다", () => {
    const o = toOpportunity(
      { title: "청년 행복주택 모집", url: "https://www.lh.or.kr/a?b=1", snippet: "가".repeat(500) },
      "housing",
      "tavily",
      new Date("2026-11-21T00:00:00Z"),
    )!;
    expect(o.origin).toBe("websearch");
    expect(o.isSample).toBe(false);
    expect(o.summary.length).toBe(200);
    expect(o.source).toBe("web-tavily");
    expect(toOpportunity({ title: "x", url: "javascript:alert(1)", snippet: "" }, "job", "exa", new Date())).toBeNull();
  });
});
