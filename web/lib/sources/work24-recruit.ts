// 고용24 채용정보 OpenAPI 중 개인회원이 쓸 수 있는 공채속보(210L21)·채용행사(210L11). 채용정보 목록(210L01)은 개인회원 불가
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, str, toIsoDate } from "./util";

const BASE = "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo";

/** 단순 XML 목록에서 반복 태그 블록과 필드를 뽑는다(외부 파서 없이) */
export function xmlItems(xml: string, tag: string): Record<string, string>[] {
  return xml.split(`<${tag}>`).slice(1).map((chunk) => {
    const body = chunk.split(`</${tag}>`)[0];
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) out[m[1]] = m[2].replace(/&amp;/g, "&").trim();
    return out;
  });
}

export function mapOpenRecruit(xml: string, now: Date): Opportunity[] {
  const today = now.toISOString().slice(0, 10);
  return xmlItems(xml, "dhsOpenEmpInfo")
    .filter((r) => r.empWantedTitle)
    .map((r) => {
      const end = toIsoDate(r.empWantedEndt);
      const types = str(r.empWantedTypeNm).split("|").filter(Boolean).join("·");
      const org = r.empBusiNm || "채용 기업";
      return {
        id: `work24-recruit:${r.empSeqno || r.empWantedTitle}`,
        domain: "job" as const,
        title: `${org} ${r.empWantedTitle}`,
        org,
        region: [],
        summary: [r.coClcdNm, types, end && `마감 ${end}`].filter(Boolean).join(" / "),
        conditions: buildConditions("job", [], ""),
        applyStart: toIsoDate(r.empWantedStdt),
        applyEnd: end,
        apply: { how: "기업 채용 페이지에서 온라인 지원", url: r.empWantedHomepgDetail || "https://www.work24.go.kr/" },
        url: r.empWantedHomepgDetail || "https://www.work24.go.kr/",
        source: "work24-recruit",
        isSample: false,
        fetchedAt: now.toISOString(),
      } satisfies Opportunity;
    })
    .filter((o) => !o.applyEnd || o.applyEnd >= today);
}

export function mapJobEvents(xml: string, now: Date): Opportunity[] {
  const today = now.toISOString().slice(0, 10);
  return xmlItems(xml, "empEvent")
    .filter((r) => r.eventNm)
    .map((r) => {
      const [from, to] = str(r.eventTerm).split("~").map((s) => s.trim());
      const end = toIsoDate((to || from || r.startDt || "").replace(/-/g, ""));
      return {
        id: `work24-event:${r.eventNo || r.eventNm}`,
        domain: "job" as const,
        title: r.eventNm.replace(/★/g, "").trim(),
        org: "고용24 채용행사",
        region: [],
        summary: [r.area, r.eventTerm && `행사 ${r.eventTerm}`].filter(Boolean).join(" / "),
        conditions: buildConditions("job", [], ""),
        applyEnd: end,
        apply: { how: "고용24 채용행사 안내에서 참가 방법 확인", url: "https://www.work24.go.kr/" },
        url: "https://www.work24.go.kr/",
        source: "work24-event",
        isSample: false,
        fetchedAt: now.toISOString(),
      } satisfies Opportunity;
    })
    .filter((o) => !!o.applyEnd && o.applyEnd >= today);
}

async function pages(id: string, key: string, maxPages: number, onRequest?: () => void): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    onRequest?.();
    const res = await fetch(`${BASE}${id}.do?authKey=${encodeURIComponent(key)}&callTp=L&returnType=XML&startPage=${page}&display=100`, { signal: AbortSignal.timeout(15000) });
    const xml = await res.text();
    if (/<error>/.test(xml)) throw new Error(xml.match(/<error>([^<]+)/)?.[1] ?? "work24 error");
    out.push(xml);
    const total = Number(xml.match(/<total>(\d+)<\/total>/)?.[1] ?? 0);
    if (page * 100 >= total) break;
  }
  return out;
}

export const work24Recruit: SourceAdapter = {
  id: "work24-recruit",
  domains: ["job"],
  envKey: "WORK24_JOB_KEY",
  async fetch(now, options = {}) {
    const key = process.env.WORK24_JOB_KEY!;
    const [recruit, events] = await Promise.all([
      pages("210L21", key, 5, options.onRequest),
      // 채용행사는 지난 행사까지 1,700여 건이라 일괄 수집에서만 전부 훑는다
      pages("210L11", key, options.full ? 20 : 3, options.onRequest).catch(() => [] as string[]),
    ]);
    return [...recruit.flatMap((x) => mapOpenRecruit(x, now)), ...events.flatMap((x) => mapJobEvents(x, now))];
  },
};
