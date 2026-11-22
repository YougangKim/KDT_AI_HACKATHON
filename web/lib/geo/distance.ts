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

export function filterMatchesByRadius(matches: Match[], location?: UserLocation): {
  matches: Match[];
  excluded: number;
} {
  if (!location || location.radiusKm === null) return { matches, excluded: 0 };
  const filtered = matches.filter((match) => {
    const distance = opportunityDistance(location, match.opportunity);
    return distance === null || distance <= location.radiusKm!;
  });
  return { matches: filtered, excluded: matches.length - filtered.length };
}
