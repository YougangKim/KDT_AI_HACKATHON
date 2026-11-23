// 선택 기능: Tavily·Exa 웹 검색으로 공고를 보충합니다. 기본값 OFF.
// 켜는 법: WEB_SEARCH_ENABLED=1 + TAVILY_API_KEY 또는 EXA_API_KEY.
// 대회 규정(이용약관 위반 데이터 금지) 때문에 기본 검색 범위는 공공기관 도메인으로 제한하고,
// 본문은 저장하지 않고 제목·링크·짧은 요약(200자)만 쓴다. 화면에는 "웹 검색 결과" 배지로 공식 API와 구분합니다.
import { createHash } from "node:crypto";
import type { Domain, Opportunity } from "../types";
import { judgeYes } from "../ai/jev";

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

export interface Hit {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

async function tavily(query: string, domains: string[], news = false): Promise<Hit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, max_results: news ? 8 : 5, include_domains: domains, search_depth: "basic", ...(news ? { topic: "news", days: 90 } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "", date: r.published_date }));
}

async function exa(query: string, domains: string[], news = false): Promise<Hit[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY! },
    body: JSON.stringify({ query, numResults: news ? 8 : 5, includeDomains: domains, contents: { highlights: { numSentences: 2 } }, ...(news ? { category: "news", startPublishedDate: new Date(Date.now() - 90 * 864e5).toISOString() } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`exa ${res.status}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; highlights?: string[]; publishedDate?: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: (r.highlights ?? []).join(" "), date: r.publishedDate }));
}

/** 개별 공고처럼 보이는 제목만 남긴다(게시판 목록·메뉴·일정 안내 페이지 제외) */
export function isPostingTitle(t: string): boolean {
  if (t.length < 6) return false;
  if (/[>＞<]|게시판|목록|공지사항|정보시스템|일정안내|훈련과정상세|사업소개|포털$/.test(t)) return false;
  return /모집|공고|채용|접수|선발|신청/.test(t);
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
  // 사이트 이름·메뉴 경로("A | B | C", "A > B")는 앞부분만, 공백 정리
  const title = hit.title.replace(/\s+/g, " ").split(/ \| | > /)[0].trim();
  if (!isPostingTitle(title)) return null;
  const id = createHash("sha1").update(hit.url).digest("hex").slice(0, 16);
  return {
    id: `web-${provider}:${id}`,
    domain,
    title: title.slice(0, 120),
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

/** JEV_API_KEY가 있으면 "청년이 지원할 수 있는 개별 모집 공고인가"를 Jev로 한 번에 판단해 0.5 미만은 뺀다. 키가 없거나 실패하면 그대로 */
async function keepPostings(items: Opportunity[]): Promise<Opportunity[]> {
  if (items.length === 0) return items;
  const p = await judgeYes(
    items.map((o, i) => ({ id: `p${i}`, 제목: o.title, 요약: o.summary, 사이트: o.org })),
    Object.fromEntries(items.map((_, i) => [`p${i}`, `p${i} 페이지가 게시판 목록이나 안내 페이지가 아니라, 청년이 지원·신청할 수 있는 개별 모집 공고인가?`])),
  );
  return p ? items.filter((_, i) => (p[`p${i}`] ?? 1) >= 0.5) : items;
}

/** 켜져 있는 제공자 순서(Tavily 우선, 실패하면 Exa로 넘어감) */
function providers(): WebProvider[] {
  if (process.env.WEB_SEARCH_ENABLED !== "1") return [];
  const out: WebProvider[] = [];
  if (process.env.TAVILY_API_KEY) out.push("tavily");
  if (process.env.EXA_API_KEY) out.push("exa");
  return out;
}

const contextCache = new Map<string, { until: number; result: Promise<{ items: Hit[]; provider: WebProvider | null }> }>();
/** 질문 답변·개인정보 대신 분야명만 전송합니다. 동일 분야 조회는 1시간 병합합니다. */
/** 관련 기사 검색 대상: 공신력 있는 주요 언론사·통신사·정책 브리핑 */
const NEWS_SITES = ["yna.co.kr", "news.kbs.co.kr", "imnews.imbc.com", "news.sbs.co.kr", "hani.co.kr", "khan.co.kr", "joongang.co.kr", "donga.com", "chosun.com", "hankyung.com", "mk.co.kr", "sedaily.com", "newsis.com", "news1.kr", "korea.kr"];

export function searchContext(domainOrList: Domain | Domain[], keywords = ""): Promise<{ items: Hit[]; provider: WebProvider | null }> {
  const domains = Array.isArray(domainOrList) ? domainOrList : [domainOrList];
  const cacheKey = `${domains.join(",")}|${keywords}`;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.result;
  const result = (async () => {
    for (const provider of providers()) {
      try {
        const items = await (provider === "tavily" ? tavily : exa)(`${keywords ? keywords + " " : ""}${domains.map((d) => QUERIES[d]).join(" ")} 청년`, NEWS_SITES, true);
        // 공신력 있는 언론사의 최근 기사만, 최신순. 본문은 저장하지 않고 제목·링크·날짜만 쓴다
        const fresh = items
          .filter((item) => /^https?:\/\//.test(item.url) && item.title)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
          .slice(0, 5)
          .map((item) => ({ title: item.title, url: item.url, snippet: "", date: item.date?.slice(0, 10) }));
        if (!fresh.length) continue;
        return { provider, items: fresh };
      } catch { /* 다음 제공자로 폴백 */ }
    }
    return { provider: null, items: [] };
  })();
  contextCache.set(cacheKey, { until: Date.now() + 60 * 60 * 1000, result });
  return result;
}

/** 켜져 있을 때만 분야별로 웹 검색해 공고 후보를 보충합니다. 한 제공자가 실패(한도 초과 등)하면 다음 제공자, 모두 실패하면 빈 배열 */
export async function searchWeb(domains: Domain[], now: Date = new Date()): Promise<Opportunity[]> {
  const list = providers();
  if (list.length === 0) return [];
  const sites = allowedDomains();
  const results = await Promise.all(
    domains.map(async (d) => {
      for (const provider of list) {
        const key = `${provider}:${d}`;
        const hit = cache.get(key);
        if (hit && now.getTime() - hit.at < TTL_MS) return hit.items;
        try {
          const hits = await (provider === "tavily" ? tavily : exa)(QUERIES[d], sites);
          const items = await keepPostings(hits.map((h) => toOpportunity(h, d, provider, now)).filter((o): o is Opportunity => o !== null));
          cache.set(key, { at: now.getTime(), items });
          return items;
        } catch (e) {
          console.warn(`[websearch] ${provider} ${d} 실패:`, (e as Error).message);
        }
      }
      return [];
    }),
  );
  return results.flat();
}
