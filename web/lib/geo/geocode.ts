import type { Opportunity } from "../types";
import { regionCenter } from "./regions";

type Geo = NonNullable<Opportunity["geo"]>;
type KakaoDocument = {
  x: string;
  y: string;
  address?: { region_1depth_name?: string };
  road_address?: { region_1depth_name?: string };
};

const cache = new Map<string, Geo | null>();
const MAX_NEW_LOOKUPS = 150;
const CONCURRENCY = 4;

export function _clearGeocodeCache() {
  cache.clear();
}

export function applyhomeAddress(summary: string): string {
  return summary.split(" · ", 1)[0].trim();
}

export function housingKeyword(title: string): string {
  return title
    .replace(/\[[^\]]*]|\([^)]*\)/g, " ")
    .replace(/\bLH\b/gi, " ")
    .replace(/(?:입주자|예비입주자)?\s*모집(?:공고)?[\s\S]*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function govRegion(org: string): string | null {
  const match = org.match(/([가-힣]+(?:특별시|광역시|특별자치시|도|특별자치도|시))\s+([가-힣]+(?:시|군|구))/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function fallback(opportunity: Opportunity): Geo | undefined {
  const center = regionCenter(opportunity.region[0]);
  return center ? { lat: center.lat, lng: center.lng, precision: "region" } : undefined;
}

function requestFor(opportunity: Opportunity): {
  endpoint: "address" | "keyword";
  query: string;
  precision: "exact" | "approx";
} | null {
  if (opportunity.place) {
    const address = /(?:특별시|광역시|특별자치시|특별자치도|도)\s+.+(?:시|군|구)/.test(opportunity.place);
    return {
      endpoint: address ? "address" : "keyword",
      query: opportunity.place,
      precision: address ? "exact" : "approx",
    };
  }
  if (opportunity.source === "applyhome") {
    const query = applyhomeAddress(opportunity.summary);
    return query ? { endpoint: "address", query, precision: "exact" } : null;
  }
  if (opportunity.source === "lh-notice" || opportunity.source === "myhome") {
    const query = housingKeyword(opportunity.title);
    return query ? { endpoint: "keyword", query, precision: "approx" } : null;
  }
  if (opportunity.source === "gov24") {
    const query = govRegion(opportunity.org);
    return query ? { endpoint: "address", query, precision: "approx" } : null;
  }
  return null;
}

function sameRegion(opportunity: Opportunity, document: KakaoDocument): boolean {
  if (!opportunity.region.length) return true;
  const resultRegion =
    document.address?.region_1depth_name ??
    document.road_address?.region_1depth_name ??
    "";
  return opportunity.region.some((region) =>
    resultRegion.includes(region) || region.includes(resultRegion.replace(/특별시|광역시|특별자치시|특별자치도|도$/g, "")),
  );
}

async function kakao(
  endpoint: "address" | "keyword",
  query: string,
  key: string,
): Promise<KakaoDocument | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/${endpoint}.json?query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const body = await response.json() as { documents?: KakaoDocument[] };
    return body.documents?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeOne(opportunity: Opportunity, key: string): Promise<Geo | undefined> {
  if (opportunity.geo) return opportunity.geo;
  const request = requestFor(opportunity);
  if (!request) return fallback(opportunity);
  const cacheKey = `${request.endpoint}:${request.query}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? fallback(opportunity);

  const document = await kakao(request.endpoint, request.query, key);
  const geo = document && sameRegion(opportunity, document)
    ? { lat: Number(document.y), lng: Number(document.x), precision: request.precision } satisfies Geo
    : null;
  cache.set(cacheKey, geo);
  return geo ?? fallback(opportunity);
}

/** 한 번의 수집 호출에서 신규 Kakao 조회를 150건까지만, 동시에 4건씩 수행한다. */
export async function attachGeo(items: Opportunity[]): Promise<Opportunity[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return items.map((item) => ({ ...item, geo: item.geo ?? fallback(item) }));

  let budget = MAX_NEW_LOOKUPS;
  let next = 0;
  const output = [...items];
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      const request = requestFor(item);
      const cacheKey = request ? `${request.endpoint}:${request.query}` : "";
      const needsLookup = !!request && !cache.has(cacheKey);
      if (needsLookup && budget-- <= 0) {
        output[index] = { ...item, geo: item.geo ?? fallback(item) };
        continue;
      }
      output[index] = { ...item, geo: await geocodeOne(item, key) };
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return output;
}
