import type { Match, Opportunity } from "../types";

export interface UserLocation {
  lat: number;
  lng: number;
  radiusKm: number | null;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: Pick<UserLocation, "lat" | "lng">, b: { lat: number; lng: number }): number {
  const earthKm = 6371;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function opportunityDistance(location: UserLocation, opportunity: Opportunity): number | null {
  const geo = opportunity.geo;
  return geo && geo.precision !== "region" ? distanceKm(location, geo) : null;
}

/** 결과 화면과 알림 서버가 공유하는 반경 판정 규칙 */
export function opportunityWithinRadius(opportunity: Opportunity, location?: UserLocation): boolean {
  if (!location || location.radiusKm === null) return true;
  const distance = opportunityDistance(location, opportunity);
  return distance === null || distance <= location.radiusKm;
}

/** 서버 저장 전 약 1km 단위로 좌표를 최소화한다. */
export function approximateLocation(location?: UserLocation): UserLocation | undefined {
  if (!location) return undefined;
  return {
    ...location,
    lat: Math.round(location.lat * 100) / 100,
    lng: Math.round(location.lng * 100) / 100,
  };
}

export function filterMatchesByRadius(matches: Match[], location?: UserLocation): {
  matches: Match[];
  excluded: number;
} {
  if (!location || location.radiusKm === null) return { matches, excluded: 0 };
  const filtered = matches.filter((match) => opportunityWithinRadius(match.opportunity, location));
  return { matches: filtered, excluded: matches.length - filtered.length };
}
