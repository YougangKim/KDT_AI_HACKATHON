// 잡알리오 공공기관 채용정보 (재정경제부, data.go.kr 15125273)
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, pickArray, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://apis.data.go.kr/1051000/recruitment/list";

export function mapJobalio(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["result"], ["response", "body", "items", "item"]]);
  return items
    .filter((r) => str(r.recrutPbancTtl))
    .map((r) => {
      const title = str(r.recrutPbancTtl);
      const work = toRegions(r.workRgnNmLst).join("·") || str(r.workRgnNmLst);
      const eligibility = [str(r.aplyQlfcCn), str(r.prefCondCn), str(r.recrutSeNm)].join(" ");
      const opp: Opportunity = {
        id: `jobalio:${str(r.recrutPblntSn) || title}`,
        domain: "job" as const,
        title,
        org: str(r.instNm) || "공공기관",
        region: [], // 근무지는 지원 자격이 아니므로 전국 지원 가능으로 둔다
        summary: [str(r.hireTypeNmLst), str(r.recrutSeNm), work && `근무지 ${work}`, str(r.recrutNope) && `${str(r.recrutNope)}명`].filter(Boolean).join(" / "),
        conditions: buildConditions("job", [], eligibility),
        applyStart: toIsoDate(r.pbancBgngYmd),
        applyEnd: toIsoDate(r.pbancEndYmd),
        url: str(r.srcUrl) || "https://job.alio.go.kr/recruit.do",
        source: "jobalio",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
      return withEligibility(opp, eligibility);
    });
}

export const jobalio: SourceAdapter = {
  id: "jobalio",
  domains: ["job"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = process.env.DATA_GO_KR_KEY!;
    const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&numOfRows=50&pageNo=1&resultType=json&ongoingYn=Y`;
    return mapJobalio(await fetchJson(url), now);
  },
};
