import { describe, expect, test } from "vitest";
import type { Match } from "../types";
import { distanceKm, filterMatchesByRadius } from "./distance";

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

  test("서울시청과 약 1도 떨어진 지점의 거리를 계산한다", () => {
    expect(distanceKm(location, { lat: 38.5665, lng: 126.978 })).toBeCloseTo(111.2, 0);
  });
});

describe("filterMatchesByRadius", () => {
  test("정확·근사 좌표만 반경으로 제외하고 지역 단위와 좌표 없음은 남긴다", () => {
    const result = filterMatchesByRadius([
      match("near", 37.57),
      match("far", 37.7, "approx"),
      match("region", 35.18, "region"),
      match("none"),
    ], location);

    expect(result.matches.map((item) => item.opportunity.id)).toEqual(["near", "region", "none"]);
    expect(result.excluded).toBe(1);
  });
});
