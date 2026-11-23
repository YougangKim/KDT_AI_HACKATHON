import { describe, expect, test } from "vitest";
import type { Match } from "../types";
import { approximateLocation, distanceKm, filterMatchesByRadius } from "./distance";

const location = { lat: 37.5665, lng: 126.978, radiusKm: 5 };
const match = (id: string, lat?: number, precision: "exact" | "approx" | "region" = "exact"): Match => ({
  opportunity: {
    id,
    domain: "job",
    title: id,
    org: "기관",
    region: ["서울"],
    summary: "",
    conditions: [],
    url: "https://example.com",
    source: "jobalio",
    isSample: false,
    fetchedAt: "2026-11-22T00:00:00Z",
    ...(lat === undefined ? {} : { geo: { lat, lng: 126.978, precision } }),
  },
  status: "eligible",
  reasons: [],
  unknowns: [],
});

describe("distanceKm", () => {
  test("같은 좌표는 0km다", () => {
    expect(distanceKm(location, location)).toBe(0);
  });

  test("서울시청과 약 1도 떨어진 지점의 거리를 계산합니다", () => {
    expect(distanceKm(location, { lat: 38.5665, lng: 126.978 })).toBeCloseTo(111.2, 0);
  });
});

describe("filterMatchesByRadius", () => {
  test("거리와 좌표 정밀도에 관계없이 모든 공고를 표시합니다", () => {
    const result = filterMatchesByRadius([
      match("near", 37.57),
      match("far", 37.7, "approx"),
      match("region", 35.18, "region"),
      match("none"),
    ], location);

    expect(result.matches.map((item) => item.opportunity.id)).toEqual(["near", "far", "region", "none"]);
    expect(result.excluded).toBe(0);
  });
});

describe("approximateLocation", () => {
  test("서버 저장용 좌표를 소수 둘째 자리로 반올림합니다", () => {
    expect(approximateLocation({ lat: 37.56651, lng: 126.97804, radiusKm: 2 })).toEqual({
      lat: 37.57,
      lng: 126.98,
      radiusKm: 2,
    });
  });
});
