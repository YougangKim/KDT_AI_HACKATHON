import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Opportunity } from "../types";
import { _resetClient } from "../ai";
import { _clearExtractCache, extractPlace, extractPlaceRules } from "./extract";
import { _clearAiCacheMemory } from "../ai/cache";
import { _resetProviders } from "../ai/providers";

const opportunity = (extra: Partial<Opportunity> = {}): Opportunity => ({
  id: "test:1",
  domain: "benefit",
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
  test("방문 신청은 본사 대신 실제 접수처 주소를 우선합니다", () => {
    expect(extractPlaceRules(opportunity({ domain: "benefit", summary: "서울특별시 강남구 테헤란로 123", apply: { how: "방문 신청", where: "서울특별시 중구 세종대로 110" } }))).toEqual({ address: "서울특별시 중구 세종대로 110", place: null });
  });
  test("주소 대신 명시된 방문 기관은 장소명으로 추출합니다", () => {
    expect(extractPlaceRules(opportunity({ apply: { how: "방문 접수", where: "서울청년센터 성동" } }))).toEqual({ address: null, place: "서울청년센터 성동" });
  });
  test("시도·시군구·도로명 주소를 규칙으로 추출", () => {
    expect(extractPlaceRules(opportunity({
      summary: "근무지는 서울특별시 강남구 테헤란로 123입니다.",
    }))).toEqual({ address: "서울특별시 강남구 테헤란로 123", place: null });
  });

  test("채용 공고는 기관·본사·접수처 주소를 근무지로 쓰지 않습니다", async () => {
    const job = opportunity({
      domain: "job",
      org: "전라남도 나주시 소재 한국공공기관",
      summary: "본사 전라남도 나주시 빛가람로 661 / 정규직",
      apply: { how: "방문 접수", where: "전라남도 나주시 빛가람로 661" },
    });
    expect(extractPlaceRules(job)).toBeNull();
    process.env.GEMINI_API_KEY = "test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractPlace(job)).toEqual({ address: null, place: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("채용 공고는 원문 근무지 문장의 주소만 씁니다", () => {
    expect(extractPlaceRules(opportunity({
      domain: "job",
      summary: "본사 전라남도 나주시 빛가람로 661 / 근무지 서울특별시 중구 세종대로 110",
    }))).toEqual({ address: "서울특별시 중구 세종대로 110", place: null });
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
