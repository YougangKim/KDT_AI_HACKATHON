import { afterEach, expect, test, vi } from "vitest";
import type { Opportunity } from "../types";
import { _clearAiCacheMemory, setCached } from "./cache";
import { _clearSummaryCache, summarizeOpportunities } from "./summary";

afterEach(() => {
  _clearAiCacheMemory();
  _clearSummaryCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("요약 영구 캐시 적중이면 AI를 호출하지 않는다", async () => {
  vi.stubEnv("AI_CACHE_DISABLE_FILE", "1");
  vi.stubEnv("GROQ_API_KEY", "test");
  const item: Opportunity = {
    id: "gov24:1",
    domain: "benefit",
    title: "청년 지원",
    org: "기관",
    region: [],
    summary: "청년을 지원합니다.",
    conditions: [],
    url: "https://example.com",
    source: "gov24",
    isSample: false,
    fetchedAt: "2026-11-22T00:00:00Z",
  };
  const input = `summary-v2\n${JSON.stringify({
    id: item.id,
    제목: item.title,
    기관: item.org,
    요약: item.summary,
    자격요건: "",
    신청방법: "",
  })}`;
  await setCached("summary", input, {
    id: item.id,
    summary: "지원 내용을 확인하세요.",
    how: "원문에서 신청 방법을 확인하세요.",
  }, 1);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  expect(await summarizeOpportunities([item])).toEqual([{
    id: item.id,
    summary: "지원 내용을 확인하세요.",
    how: "원문에서 신청 방법을 확인하세요.",
  }]);
  expect(fetchMock).not.toHaveBeenCalled();
});
