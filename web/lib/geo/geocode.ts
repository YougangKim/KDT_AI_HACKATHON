import { getCached, setCached } from "../ai/cache";
import type { Opportunity } from "../types";
import { regionAliases, regionCenter } from "./regions";

type Geo = NonNullable<Opportunity["geo"]>;
type KakaoDocument = {
  x: string;
  y: string;
  address_name?: string;
  address?: { address_name?: string; region_1depth_name?: string };
  road_address?: { address_name?: string; region_1depth_name?: string };
};
type GeocodeRequest = { endpoint: "address" | "keyword"; query: string; precision: "exact" | "approx" };

const cache = new Map<string, Geo | null>();
const MAX_NEW_LOOKUPS = 150;
const CONCURRENCY = 4;
const GEOCODE_VERSION = "kakao-v1";

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

export function branchKeyword(title: string): string | null {
  const cleaned = title.replace(/\[[^\]]*]|\([^)]*\)/g, " ").replace(/\s+/g, " ");
  return cleaned.match(
    /(?:[가-힣A-Za-z0-9·-]+\s+)?[가-힣A-Za-z0-9·-]+(?:출장소|지사|지점|사업소|본부|센터|병원|공단)/,
  )?.[0]?.trim() ?? null;
}

function govRegion(org: string): string | null {
  const match = org.match(/([가-힣]+(?:특별시|광역시|특별자치시|도|특별자치도|시))\s+([가-힣]+(?:시|군|구))/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function fallback(opportunity: Opportunity): Geo | undefined {
  const center = regionCenter(opportunity.region[0]);
  return center ? { lat: center.lat, lng: center.lng, precision: "region" } : undefined;
}

function requestsFor(opportunity: Opportunity): GeocodeRequest[] {
  if (opportunity.place) {
    const address = /(?:특별시|광역시|특별자치시|특별자치도|도)\s+.+(?:시|군|구)/.test(opportunity.place);
    return [{
      endpoint: address ? "address" : "keyword",
      query: opportunity.place,
      precision: address ? "exact" : "approx",
    }];
  }
  if (opportunity.source === "applyhome") {
    const query = applyhomeAddress(opportunity.summary);
    return query ? [{ endpoint: "address", query, precision: "exact" }] : [];
  }
  if (opportunity.source === "lh-notice" || opportunity.source === "myhome") {
    const query = housingKeyword(opportunity.title);
    return query ? [{ endpoint: "keyword", query, precision: "approx" }] : [];
  }
  if (opportunity.source === "jobalio") {
    const branch = branchKeyword(opportunity.title);
    return [
      ...(branch ? [{ endpoint: "keyword" as const, query: `${opportunity.org} ${branch}`, precision: "approx" as const }] : []),
      { endpoint: "keyword", query: opportunity.org, precision: "approx" },
    ];
  }
  if (opportunity.source === "gov24") {
    const query = govRegion(opportunity.org);
    return query ? [{ endpoint: "address", query, precision: "approx" }] : [];
  }
  return [];
}

/** 제목에 시·군 이름(예: "순천시", "순천출장소")이 있으면 결과 주소에도 그 시·군이 있어야 한다 */
export function sameCity(title: string, document: KakaoDocument): boolean {
  const address = [document.address_name, document.address?.address_name, document.road_address?.address_name].filter(Boolean).join(" ");
  const cities = [...title.matchAll(/([가-힣]{2,4})(?:시|군)(?=[\s·(,]|$)|([가-힣]{2,3})(?:출장소|지사|지점|사업소)/g)]
    .map((m) => m[1] ?? m[2])
    .filter((c) => c && !/^(광역|특별|도시|청년|공공|임대|모집)/.test(c));
  if (!cities.length || !address) return true;
  return cities.some((c) => address.includes(c));
}

function sameRegion(opportunity: Opportunity, document: KakaoDocument): boolean {
  if (!sameCity(opportunity.title, document)) return false;
  if (!opportunity.region.length) return true;
  const resultRegion =
    document.address?.region_1depth_name ??
    document.road_address?.region_1depth_name ??
    "";
  const aliases = regionAliases(resultRegion);
  return opportunity.region.some((region) => aliases.some((alias) => region.includes(alias) || alias.includes(region)));
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
  for (const request of requestsFor(opportunity)) {
    const cacheKey = `${request.endpoint}:${request.query}`;
    if (!cache.has(cacheKey)) {
      const persisted = await getCached<Geo | false>("geocode", `${GEOCODE_VERSION}:${cacheKey}`);
      if (persisted !== null) cache.set(cacheKey, persisted || null);
    }
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      continue;
    }
    const document = await kakao(request.endpoint, request.query, key);
    const address = document?.road_address?.address_name ?? document?.address?.address_name ?? document?.address_name;
    const geo = document && sameRegion(opportunity, document)
      ? {
          lat: Number(document.y),
          lng: Number(document.x),
          precision: request.precision,
          ...(address ? { address } : {}),
        } satisfies Geo
      : null;
    cache.set(cacheKey, geo);
    await setCached("geocode", `${GEOCODE_VERSION}:${cacheKey}`, geo ?? false, geo ? 90 : 1);
    if (geo) return geo;
  }
  return fallback(opportunity);
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
      const requests = requestsFor(item);
      const request = requests[0];
      const cacheKey = request ? `${request.endpoint}:${request.query}` : "";
      if (request && !cache.has(cacheKey)) {
        const hit = await getCached<Geo | false>("geocode", `${GEOCODE_VERSION}:${cacheKey}`);
        if (hit !== null) cache.set(cacheKey, hit || null);
      }
      const needsLookup = Boolean(request && !cache.has(cacheKey));
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
