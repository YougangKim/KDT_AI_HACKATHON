// 선택 기능: SH(서울주택도시공사) 공식 RSS "공고 및 공지" 피드로 주거 공고를 보충한다. 기본값 OFF(SH_RSS_ENABLED=1일 때만).
// SH가 "블로그나 리더기에 등록하여 이용"하라고 안내하는 공식 피드만 읽는다(게시판 크롤링 아님).
// 제목·링크·게시일만 쓰고 본문(content:encoded)은 저장하지 않는다. 실패하면 빈 배열(기존 흐름 영향 없음).
import { createHash } from "node:crypto";
import type { Opportunity } from "../types";

export const SH_RSS_URL = "https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/rss/rssNoticeWrite.do";
const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; items: Opportunity[] } | null = null;

export const shRssEnabled = () => process.env.SH_RSS_ENABLED === "1";

export interface RssItem {
  title: string;
  link: string;
  pubDate: string;
}

const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

export function parseRss(xml: string): RssItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const pick = (tag: string) => decodeEntities(m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
    return { title: pick("title"), link: pick("link"), pubDate: pick("pubDate") };
  });
}

/** 모집·입주자·청약 공고만 남기고 당첨자 발표·결과·합격자 같은 공지는 뺀다 */
export function isRecruitment(title: string): boolean {
  return /모집|입주자|청약|공급/.test(title) && !/당첨|발표|결과|합격|선정자|계약 안내|취소/.test(title);
}

export function toOpportunity(it: RssItem, now: Date): Opportunity | null {
  if (!it.title || !it.link) return null;
  let url: URL;
  try {
    url = new URL(it.link);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith("i-sh.co.kr")) return null;
  url.protocol = "https:";
  const posted = new Date(it.pubDate);
  const postedText = Number.isNaN(posted.getTime()) ? "" : posted.toISOString().slice(0, 10);
  return {
    id: `sh-rss:${createHash("sha1").update(url.href).digest("hex").slice(0, 16)}`,
    domain: "housing",
    title: it.title.slice(0, 120),
    org: "SH 서울주택도시공사",
    region: ["서울"],
    summary: `SH 공식 RSS${postedText ? ` · 게시일 ${postedText}` : ""} · 자격·마감은 원문에서 확인`,
    conditions: [],
    url: url.href,
    source: "sh-rss",
    isSample: false,
    origin: "rss",
    fetchedAt: now.toISOString(),
  };
}

export async function fetchShRss(now: Date = new Date()): Promise<Opportunity[]> {
  if (!shRssEnabled()) return [];
  if (cache && now.getTime() - cache.at < TTL_MS) return cache.items;
  try {
    const res = await fetch(SH_RSS_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RSS reader)", accept: "application/rss+xml, application/xml" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`sh-rss ${res.status}`);
    const xml = new TextDecoder("euc-kr").decode(await res.arrayBuffer());
    const items = parseRss(xml)
      .filter((it) => isRecruitment(it.title))
      .map((it) => toOpportunity(it, now))
      .filter((o): o is Opportunity => o !== null);
    cache = { at: now.getTime(), items };
    return items;
  } catch (e) {
    console.warn("[sh-rss] 실패:", (e as Error).message);
    return [];
  }
}
