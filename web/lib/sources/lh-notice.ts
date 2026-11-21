// LH 분양임대공고문 조회 (data.go.kr 15058530) — 임대주택 모집공고
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1";

/** 응답은 [ {dsSch}, {dsList: [...], resHeader} ] 형태 */
export function mapLhNotice(raw: unknown, now: Date): Opportunity[] {
  const blocks = Array.isArray(raw) ? raw : [raw];
  const list = blocks.flatMap((b) => {
    const ds = b && typeof b === "object" ? (b as Record<string, unknown>).dsList : undefined;
    return Array.isArray(ds) ? (ds as Record<string, unknown>[]) : [];
  });
  return list
    .filter((r) => str(r.PAN_NM))
    .map((r) => {
      const title = str(r.PAN_NM);
      const region = toRegions(r.CNP_CD_NM);
      const type = [str(r.UPP_AIS_TP_NM), str(r.AIS_TP_CD_NM)].filter(Boolean).join(" · ");
      return {
        id: `lh-notice:${str(r.PAN_ID) || title}`,
        domain: "housing" as const,
        title,
        org: "한국토지주택공사",
        region,
        summary: [type, str(r.PAN_SS)].filter(Boolean).join(" / ") || "LH 임대주택 모집공고",
        conditions: buildConditions("housing", region, title),
        applyStart: toIsoDate(r.PAN_NT_ST_DT),
        applyEnd: toIsoDate(r.CLSG_DT),
        url: str(r.DTL_URL) || "https://apply.lh.or.kr/",
        source: "lh-notice",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
    });
}

export const lhNotice: SourceAdapter = {
  id: "lh-notice",
  domains: ["housing"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = process.env.DATA_GO_KR_KEY!;
    // UPP_AIS_TP_CD=06: 임대주택, PAN_SS=공고중
    const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&PG_SZ=50&PAGE=1&UPP_AIS_TP_CD=06&PAN_SS=${encodeURIComponent("공고중")}`;
    return mapLhNotice(await fetchJson(url), now);
  },
};
