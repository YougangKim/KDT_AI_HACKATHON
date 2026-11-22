import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Opportunity } from "../types";
import { _clearGeocodeCache, applyhomeAddress, attachGeo, branchKeyword } from "./geocode";

const opportunity = (extra: Partial<Opportunity> = {}): Opportunity => ({
  id: "applyhome:1",
  domain: "housing",
  title: "서울 청년주택",
  org: "서울특별시 중구",
  region: ["서울"],
  summary: "서울특별시 중구 세종대로 110 · 청년주택",
  conditions: [],
  url: "https://example.com",
  source: "applyhome",
  isSample: false,
  fetchedAt: "2026-11-22T00:00:00Z",
  ...extra,
});

beforeEach(() => {
  _clearGeocodeCache();
  delete process.env.KAKAO_REST_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("attachGeo", () => {
  test("키가 없으면 첫 시도의 중심 좌표를 붙인다", async () => {
    const [result] = await attachGeo([opportunity()]);
    expect(result.geo).toEqual({ lat: 37.5665, lng: 126.978, precision: "region" });
  });

  test("전국 공고는 키가 없을 때 좌표를 붙이지 않는다", async () => {
    const [result] = await attachGeo([opportunity({ region: [] })]);
    expect(result.geo).toBeUndefined();
  });

  test("청약홈 요약의 첫 구간을 주소로 쓴다", () => {
    expect(applyhomeAddress("서울특별시 중구 세종대로 110 · 공급 20세대")).toBe("서울특별시 중구 세종대로 110");
  });

  test("같은 주소는 Kakao 응답을 캐시한다", async () => {
    process.env.KAKAO_REST_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [{
          x: "126.978",
          y: "37.5665",
          address_name: "서울특별시 중구 세종대로 110",
          address: { region_1depth_name: "서울" },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await attachGeo([opportunity()]);
    await attachGeo([opportunity({ id: "applyhome:2" })]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("카카오 주소명을 geo.address에 저장한다", async () => {
    process.env.KAKAO_REST_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [{
          x: "126.978",
          y: "37.5665",
          address_name: "서울특별시 중구 세종대로 110",
          address: { region_1depth_name: "서울" },
        }],
      }),
    }));
    const [result] = await attachGeo([opportunity()]);
    expect(result.geo?.address).toBe("서울특별시 중구 세종대로 110");
  });

  test("채용 제목에서 지점명을 뽑고 다른 시도 결과는 버린 뒤 기관명으로 재검색한다", async () => {
    process.env.KAKAO_REST_API_KEY = "test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documents: [{ x: "129.0756", y: "35.1796", address: { region_1depth_name: "부산광역시" } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documents: [{
            x: "126.978",
            y: "37.5665",
            address_name: "서울특별시 중구",
            address: { region_1depth_name: "서울특별시" },
          }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const [result] = await attachGeo([opportunity({
      source: "jobalio",
      domain: "job",
      title: "한국공공기관 서울지사 청년인턴 모집",
      org: "한국공공기관",
    })]);
    expect(branchKeyword("한국공공기관 서울지사 청년인턴 모집")).toContain("서울지사");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.geo).toMatchObject({ lat: 37.5665, lng: 126.978, precision: "approx" });
  });
});
