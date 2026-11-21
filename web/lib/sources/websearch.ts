// 선택 기능: Tavily·Exa 웹 검색으로 공고를 보충한다. 기본값 OFF.
// 켜는 법: WEB_SEARCH_ENABLED=1 + TAVILY_API_KEY 또는 EXA_API_KEY.
// 대회 규정(이용약관 위반 데이터 금지) 때문에 기본 검색 범위는 공공기관 도메인으로 제한하고,
// 본문은 저장하지 않고 제목·링크·짧은 요약(200자)만 쓴다. 화면에는 "웹 검색 결과" 배지로 공식 API와 구분한다.
import { createHash } from "node:crypto";
import type { Domain, Opportunity } from "../types";

const DEFAULT_DOMAINS = [
  "lh.or.kr",
  "myhome.go.kr",
  "i-sh.co.kr",
  "gov.kr",
  "youthcenter.go.kr",
  "job.alio.go.kr",
  "work24.go.kr",
  "q-net.or.kr",
  "bokjiro.go.kr",
  "seoul.go.kr",
  "gg.go.kr",
];

const QUERIES: Record<Domain, string> = {
  housing: "청년 임대주택 입주자 모집공고",
  job: "공공기관 청년인턴 채용공고",
  parttime: "청년 일자리 단기 근로 모집",
  benefit: "청년 지원금 신청 공고",
  training: "국민내일배움카드 K-디지털 트레이닝 모집",
  exam: "국가기술자격 시험 원서접수 일정",
};

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; items: Opportunity[] }>();

export type WebProvider = "tavily" | "exa";

export function webSearchProvider(): WebProvider | null {
  if (process.env.WEB_SEARCH_ENABLED !== "1") return null;
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.EXA_API_KEY) return "exa";
  return null;
}

function allowedDomains(): string[] {
  const env = process.env.WEB_SEARCH_DOMAINS?.split(",").map((s) => s.trim()).filter(Boolean);
  return env?.length ? env : DEFAULT_DOMAINS;
}

interface Hit {
  title: string;
  url: string;
  snippet: string;
}

async function tavily(query: string, domains: string[]): Promise<Hit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, max_results: 5, include_domains: domains, search_depth: "basic" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "" }));
}

async function exa(query: string, domains: string[]): Promise<Hit[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY! },
    body: JSON.stringify({ query, numResults: 5, includeDomains: domains, contents: { highlights: { numSentences: 2 } } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`exa ${res.status}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; highlights?: string[] }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: (r.highlights ?? []).join(" ") }));
}

export function toOpportunity(hit: Hit, domain: Domain, provider: WebProvider, now: Date): Opportunity | null {
  let host = "";
  try {
    const u = new URL(hit.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!hit.title.trim()) return null;
  const id = createHash("sha1").update(hit.url).digest("hex").slice(0, 16);
  return {
    id: `web-${provider}:${id}`,
    domain,
    title: hit.title.trim().slice(0, 120),
    org: host,
    region: [],
    summary: hit.snippet.replace(/\s+/g, " ").trim().slice(0, 200),
    conditions: [],
    url: hit.url,
    source: `web-${provider}`,
    isSample: false,
    origin: "websearch",
    fetchedAt: now.toISOString(),
  };
}

/** 켜져 있을 때만 분야별로 웹 검색해 공고 후보를 보충한다. 실패하면 빈 배열(공식 API·샘플 흐름에 영향 없음) */
export async function searchWeb(domains: Domain[], now: Date = new Date()): Promise<Opportunity[]> {
  const provider = webSearchProvider();
  if (!provider) return [];
  const sites = allowedDomains();
  const results = await Promise.all(
    domains.map(async (d) => {
      const key = `${provider}:${d}`;
      const hit = cache.get(key);
      if (hit && now.getTime() - hit.at < TTL_MS) return hit.items;
      try {
        const hits = await (provider === "tavily" ? tavily : exa)(QUERIES[d], sites);
        const items = hits.map((h) => toOpportunity(h, d, provider, now)).filter((o): o is Opportunity => o !== null);
        cache.set(key, { at: now.getTime(), items });
        return items;
      } catch (e) {
        console.warn(`[websearch] ${provider} ${d} 실패:`, (e as Error).message);
        return [];
      }
    }),
  );
  return results.flat();
}
