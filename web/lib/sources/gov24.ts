// 행정안전부 대한민국 공공서비스(혜택) 정보 (data.go.kr 15113968, api.odcloud.kr)
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, pickArray, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://api.odcloud.kr/api/gov24/v3/serviceList";

export function mapGov24(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["data"]]);
  return items
    .filter((r) => str(r["서비스명"]))
    .map((r) => {
      const title = str(r["서비스명"]);
      const org = str(r["소관기관명"]);
      // 지자체 서비스면 소관기관명(예: "서울특별시 강남구")에서 지역을 뽑는다. 중앙부처는 전국
      const region = /(특별시|광역시|특별자치|도)$/.test(org.split(" ")[0] ?? "") ? toRegions(org.split(" ")[0]) : [];
      const deadline = str(r["신청기한"]);
      const endMatch = deadline.match(/~\s*(.+)$/);
      const opp: Opportunity = {
        id: `gov24:${str(r["서비스ID"]) || title}`,
        domain: "benefit" as const,
        title,
        org: org || "정부24",
        region,
        summary: str(r["서비스목적요약"]) || str(r["지원내용"]).slice(0, 120),
        conditions: buildConditions("benefit", region, [str(r["지원대상"]), str(r["선정기준"])].join(" ")),
        applyEnd: /상시/.test(deadline) ? undefined : toIsoDate(endMatch ? endMatch[1] : deadline),
        url: str(r["상세조회URL"]) || "https://www.gov.kr/portal/rcvfvrSvc/main",
        source: "gov24",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
      return withEligibility(opp, [str(r["지원대상"]), str(r["선정기준"])].join(" "));
    });
}

export const gov24: SourceAdapter = {
  id: "gov24",
  domains: ["benefit"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = process.env.DATA_GO_KR_KEY!;
    const url = `${ENDPOINT}?page=1&perPage=50&returnType=JSON&serviceKey=${encodeURIComponent(key)}&${encodeURIComponent("cond[서비스명::LIKE]")}=${encodeURIComponent("청년")}`;
    return mapGov24(await fetchJson(url), now);
  },
};
