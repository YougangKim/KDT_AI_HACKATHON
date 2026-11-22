import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Opportunity } from "../types";
import { _resetClient } from "../ai";
import { _clearExtractCache, extractPlace, extractPlaceRules } from "./extract";
import { _clearAiCacheMemory } from "../ai/cache";
import { _resetProviders } from "../ai/providers";

const opportunity = (extra: Partial<Opportunity> = {}): Opportunity => ({
  id: "test:1",
  domain: "job",
  title: "청년인턴 모집",
  org: "한국공공기관",
  region: ["서울"],
  summary: "",
  conditions: [],
  url: "https://example.com",
  source: "test",
  isSample: false,
  fetchedAt: "2026-11-22T00:00:00Z",
  ...extra,
});

beforeEach(() => {
  _clearExtractCache();
  _clearAiCacheMemory();
  _resetProviders();
  _resetClient();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("공고 장소 추출", () => {
  test("시도·시군구·도로명 주소를 규칙으로 추출", () => {
    expect(extractPlaceRules(opportunity({
      summary: "근무지는 서울특별시 강남구 테헤란로 123입니다.",
    }))).toEqual({ address: "서울특별시 강남구 테헤란로 123", place: null });
  });

  test("청약홈 요약 앞부분을 주소로 추출", () => {
    expect(extractPlaceRules(opportunity({
      source: "applyhome",
      summary: "경기도 수원시 팔달구 인계동 · 120세대",
    }))).toEqual({ address: "경기도 수원시 팔달구 인계동", place: null });
  });

  test("Gemini JSON을 파싱하고 같은 공고의 결과를 캐시", async () => {
    process.env.GEMINI_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: '```json\n{"address":null,"place":"한국공공기관 대전 본사"}\n```' }],
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await extractPlace(opportunity());
    const second = await extractPlace(opportunity());

    expect(first).toEqual({ address: null, place: "한국공공기관 대전 본사" });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Gemini 실패도 캐시", async () => {
    process.env.GEMINI_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await extractPlace(opportunity());
    await extractPlace(opportunity());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
