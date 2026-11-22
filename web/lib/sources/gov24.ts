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
      // 지자체·공공기관의 청년 아르바이트(행정인턴·대학생 아르바이트 등)는 알바로 분류
      const domain = /아르바이트|알바|행정인턴|단기\s?일자리|일경험/.test(title) ? ("parttime" as const) : ("benefit" as const);
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
        domain,
        title,
        org: org || "정부24",
        region,
        summary: str(r["서비스목적요약"]) || support.slice(0, 80),
        conditions: buildConditions(
          domain,
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

// 서비스명에 "청년"이 없어도 청년이 받을 수 있는 개인 대상 서비스(전체 1만여 건 중 일부)
const YOUTH_HINT = /청년|대학생|대학원생|취업준비|구직자|미취업|사회초년|신혼|만\s?(19|2\d|3\d)세/;
const OTHER_GROUP = /노인|어르신|65세|고령|경로|영유아|아동|유아|초등|중학|고등학생|임산|출산|산모|장애|농업인|어업인|농가|어가|축산|참전|보훈|국가유공|다문화|북한이탈|한부모|노숙|수형|군인|사업자|법인|기업|소상공인|어린이|보육|만\s?(4\d|5\d|6\d)세 이상/;

/** 전체 수집에서 청년과 관련 있는 서비스만 남긴다: 청년 대상이 명시됐거나, 다른 집단 전용이 아닌 개인·가구 대상 */
export function youthRelevantGov24(r: Record<string, unknown>): boolean {
  const target = [str(r["서비스명"]), str(r["지원대상"])].join(" ");
  if (YOUTH_HINT.test([target, str(r["선정기준"]), str(r["서비스목적요약"])].join(" "))) return true;
  return /개인|가구/.test(str(r["사용자구분"])) && !OTHER_GROUP.test(target);
}

export const gov24: SourceAdapter = {
  id: "gov24",
  domains: ["benefit", "parttime"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now, options = {}) {
    const key = process.env.DATA_GO_KR_KEY!;
    if (options.full) {
      // 일괄 수집: 서비스 전체(약 1만 건)를 1,000건씩 받아 청년 관련만 남긴다(호출 약 11회)
      const url = (page: number) => `${ENDPOINT}?page=${page}&perPage=1000&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
      const map = (raw: unknown) => {
        const rows = pickArray(raw, [["data"]]).filter(youthRelevantGov24);
        return mapGov24({ data: rows }, now);
      };
      return fetchAllPages("gov24", 1000, 30, (p) => {
        options.onRequest?.();
        return fetchJson(url(p));
      }, map);
    }
    // 화면 요청 폴백: 서비스명에 "청년"이 들어간 지원만 100건씩
    const url = (page: number) => `${ENDPOINT}?page=${page}&perPage=100&returnType=JSON&serviceKey=${encodeURIComponent(key)}&${encodeURIComponent("cond[서비스명::LIKE]")}=${encodeURIComponent("청년")}`;
    return fetchAllPages(
      "gov24",
      100,
      20,
      (p) => {
        options.onRequest?.();
        return fetchJson(url(p));
      },
      (raw) => mapGov24(raw, now),
    );
  },
};
