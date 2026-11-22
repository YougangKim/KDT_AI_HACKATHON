// 행정안전부 대한민국 공공서비스(혜택) 정보 (data.go.kr 15113968, api.odcloud.kr)
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, fetchAllPages, pickArray, str, toIsoDate, toRegions } from "./util";

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
      const support = str(r["지원내용"]);
      const detailUrl = str(r["상세조회URL"]) || "https://www.gov.kr/portal/rcvfvrSvc/main";
      const how = str(r["신청방법"]).replace(/\s+/g, " ");
      const where = str(r["접수기관"]);
      const opp: Opportunity = {
        id: `gov24:${str(r["서비스ID"]) || title}`,
        domain: "benefit" as const,
        title,
        org: org || "정부24",
        region,
        summary: str(r["서비스목적요약"]) || support.slice(0, 80),
        conditions: buildConditions(
          "benefit",
          region,
          [str(r["지원대상"]), str(r["선정기준"])].join(" "),
          str(r["서비스분야"]) ? [{ attr: "need", op: "eq", value: str(r["서비스분야"]), rawText: `지원 분야: ${str(r["서비스분야"])}`, confidence: "high" }] : [],
        ),
        applyEnd: /상시/.test(deadline) ? undefined : toIsoDate(endMatch ? endMatch[1] : deadline),
        apply: { how: how || "정부24 상세 페이지에서 신청 방법 확인", where: where || undefined, url: detailUrl },
        url: detailUrl,
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
    // 서비스명에 "청년"이 들어간 지원 전체를 전체 건수(matchCount)만큼 100건씩 받는다
    const url = (page: number) => `${ENDPOINT}?page=${page}&perPage=100&returnType=JSON&serviceKey=${encodeURIComponent(key)}&${encodeURIComponent("cond[서비스명::LIKE]")}=${encodeURIComponent("청년")}`;
    return fetchAllPages("gov24", 100, 20, (p) => fetchJson(url(p)), (raw) => mapGov24(raw, now));
  },
};
