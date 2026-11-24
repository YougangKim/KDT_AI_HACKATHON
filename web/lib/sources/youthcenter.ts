// 온통청년 청년정책 API (한국고용정보원)
import type { Condition, Domain, Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, parsePeriod, pickArray, str, toRegions } from "./util";

const ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

function domainOf(category: string): Domain {
  if (/주거/.test(category)) return "housing";
  // 온통청년의 일자리·취업·창업 분류는 채용 공고가 아니라 정책·지원사업이므로 채용 직무 필터와 섞지 않는다
  if (/일자리|취업|창업/.test(category)) return "benefit";
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
  envKey: "YOUTHCENTER_API_KEY",
  async fetch(now, options = {}) {
    const key = process.env.YOUTHCENTER_API_KEY!;
    const url = (page: number, size: number) => `${ENDPOINT}?apiKeyNm=${encodeURIComponent(key)}&pageNum=${page}&pageSize=${size}&rtnType=json`;
    if (!options.full) {
      options.onRequest?.();
      return mapYouthcenter(await fetchJson(url(1, 50)), now);
    }
    // 일괄 수집: 전체 정책(약 4천 건)을 100건씩 전부 받는다(호출 약 40회). 마감 지난 정책은 후처리에서 빠진다
    options.onRequest?.();
    const first = await fetchJson(url(1, 100), 15000) as { result?: { pagging?: { totCount?: number } } };
    const total = Number(first.result?.pagging?.totCount ?? 0);
    const pages = Math.min(60, Math.max(1, Math.ceil(total / 100)));
    const out = mapYouthcenter(first, now);
    for (let start = 2; start <= pages; start += 5) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(5, pages - start + 1) }, (_, i) => {
          options.onRequest?.();
          return fetchJson(url(start + i, 100), 15000).then((raw) => mapYouthcenter(raw, now)).catch(() => [] as Opportunity[]);
        }),
      );
      out.push(...batch.flat());
    }
    return out;
  },
};
