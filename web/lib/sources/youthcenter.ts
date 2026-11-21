// 온통청년 청년정책 API (한국고용정보원) — 담당자 심사 후 키 발급. 응답 필드는 키 발급 후 재확인 필요
import type { Condition, Domain, Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, parsePeriod, pickArray, str, toRegions } from "./util";

const ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

function domainOf(category: string): Domain {
  if (/주거/.test(category)) return "housing";
  if (/일자리|취업|창업/.test(category)) return "job";
  if (/교육|훈련/.test(category)) return "training";
  return "benefit";
}

export function mapYouthcenter(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["result", "youthPolicyList"], ["youthPolicyList"]]);
  return items
    .filter((r) => str(r.plcyNm))
    .map((r) => {
      const title = str(r.plcyNm);
      const domain = domainOf(`${str(r.lclsfNm)} ${str(r.mclsfNm)}`);
      const region = toRegions(r.rgtrUpInstCdNm);
      const extra: Condition[] = [];
      const min = Number(r.sprtTrgtMinAge);
      const max = Number(r.sprtTrgtMaxAge);
      if (str(r.sprtTrgtAgeLmtYn) !== "N") {
        if (min > 0) extra.push({ attr: "age", op: "gte", value: min, rawText: `만 ${min}세 이상`, confidence: "high" });
        if (max > 0) extra.push({ attr: "age", op: "lte", value: max, rawText: `만 ${max}세 이하`, confidence: "high" });
      }
      const [applyStart, applyEnd] = parsePeriod(r.aplyYmd);
      const opp: Opportunity = {
        id: `youthcenter:${str(r.plcyNo) || title}`,
        domain,
        title,
        org: str(r.sprvsnInstCdNm) || str(r.operInstCdNm) || "온통청년",
        region,
        summary: (str(r.plcyExplnCn) || str(r.plcySprtCn)).slice(0, 160),
        conditions: buildConditions(domain, region, [str(r.addAplyQlfcCndCn), str(r.earnEtcCn), str(r.ptcpPrpTrgtCn)].join(" "), extra),
        applyStart,
        applyEnd,
        url: str(r.aplyUrlAddr) || str(r.refUrlAddr1) || "https://www.youthcenter.go.kr/",
        source: "youthcenter",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
      return withEligibility(opp, [str(r.addAplyQlfcCndCn), str(r.earnEtcCn), str(r.ptcpPrpTrgtCn)].join(" "));
    });
}

export const youthcenter: SourceAdapter = {
  id: "youthcenter",
  domains: ["benefit", "housing", "job", "training"],
  envKey: "YOUTHCENTER_KEY",
  async fetch(now) {
    const key = process.env.YOUTHCENTER_KEY!;
    const url = `${ENDPOINT}?apiKeyNm=${encodeURIComponent(key)}&pageNum=1&pageSize=50&rtnType=json`;
    return mapYouthcenter(await fetchJson(url), now);
  },
};
