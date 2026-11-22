import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("Tavily가 한도 초과로 실패하면 Exa로 넘어간다", async () => {
    process.env.WEB_SEARCH_ENABLED = "1";
    process.env.TAVILY_API_KEY = "t";
    process.env.EXA_API_KEY = "e";
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("tavily")
        ? new Response("{}", { status: 432 })
        : new Response(JSON.stringify({ results: [{ title: "청년 매입임대 모집", url: "https://lh.or.kr/a", highlights: ["요약"] }] })),
    ));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = await searchWeb(["benefit"]);
    vi.unstubAllGlobals();
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("web-exa");
  });
  it("메뉴·게시판 목록 페이지는 버리고 공고 제목만 남긴다", () => {
    const mk = (title: string) => toOpportunity({ title, url: "https://lh.or.kr/x", snippet: "" }, "housing", "exa", new Date());
    expect(mk("서울주택도시개발공사 >SH소식>공고 및 공지>전체")).toBeNull();
    expect(mk("공지사항 게시판목록 | 경기청년포털")).toBeNull();
    expect(mk("일정안내 | Q-net")).toBeNull();
    expect(mk("서울시 청년안심주택 모집공고 | 서울주거포털")?.title).toBe("서울시 청년안심주택 모집공고");
  });
});
