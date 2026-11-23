// 잡알리오 공공기관 채용정보 (재정경제부, data.go.kr 15125273)
import type { Condition, Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, withEligibility, fetchJson, fetchAllPages, pickArray, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://apis.data.go.kr/1051000/recruitment/list";

const EDU_LEVEL: [RegExp, number][] = [[/고졸/, 1], [/대졸\(2~3년\)/, 2], [/대졸\(4년\)/, 3], [/석사/, 4], [/박사/, 5]];

/** 경력직 전용·학력 하한·직무 분야(NCS)를 조건으로 */
export function jobConditions(r: Record<string, unknown>): Condition[] {
  const out: Condition[] = [];
  if (str(r.recrutSeNm) === "경력") out.push({ attr: "experienced", op: "eq", value: true, rawText: "경력직 채용", confidence: "high" });
  const edu = str(r.acbgCondNmLst);
  if (edu && !/학력무관/.test(edu)) {
    const levels = EDU_LEVEL.filter(([re]) => re.test(edu)).map(([, n]) => n);
    if (levels.length) out.push({ attr: "education", op: "gte", value: Math.min(...levels), rawText: `학력: ${edu}`, confidence: "high" });
  }
  const fields = [...new Set(str(r.ncsCdNmLst).split(",").map((f) => f.trim().replace(/\./g, "·")).filter(Boolean))];
  if (fields.length) out.push({ attr: "field", op: "in", value: fields, rawText: `직무: ${fields.join(", ")}`, confidence: "high" });
  return out;
}

/** 공공기관 단기·기간제·대체인력 일자리는 "알바·단기" 분야로(청년인턴은 채용으로 둔다) */
export function shortTerm(title: string, hireType = ""): boolean {
  if (/인턴/.test(title)) return false;
  return /단기|시간제|아르바이트|알바|일용|계절|방학|기간제|대체\s*인력|대체직|한시적/.test(`${title} ${hireType}`);
}

export function mapJobalio(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["result"], ["response", "body", "items", "item"]]);
  return items
    .filter((r) => str(r.recrutPbancTtl))
    .map((r) => {
      const title = str(r.recrutPbancTtl);
      const work = toRegions(r.workRgnNmLst).join("·") || str(r.workRgnNmLst);
      const eligibility = [str(r.aplyQlfcCn), str(r.prefCondCn), str(r.recrutSeNm)].join(" ");
      const domain = shortTerm(title, str(r.hireTypeNmLst)) ? ("parttime" as const) : ("job" as const);
      const applyEnd = toIsoDate(r.pbancEndYmd);
      const url = str(r.srcUrl).match(/https?:\/\/[^\s,]+/)?.[0] ?? "https://job.alio.go.kr/recruit.do";
      const opp: Opportunity = {
        id: `jobalio:${str(r.recrutPblntSn) || title}`,
        domain,
        title,
        org: str(r.instNm) || "공공기관",
        // 근무지를 지역 조건으로 둔다: "부산에 살아요"라고 한 사람에게 전북 근무 공고를 1위로 보이지 않게.
        // 이사·출퇴근 의향이 있으면 결과 화면의 "다른 지역도 보기" 완화로 다시 볼 수 있습니다.
        region: toRegions(r.workRgnNmLst),
        summary: [str(r.hireTypeNmLst), str(r.recrutSeNm), work && `근무지 ${work}`, str(r.recrutNope) && `${str(r.recrutNope)}명`].filter(Boolean).join(" / "),
        conditions: buildConditions(domain, toRegions(r.workRgnNmLst), eligibility, jobConditions(r)),
        applyStart: toIsoDate(r.pbancBgngYmd),
        applyEnd,
        apply: { how: `기관 채용 사이트에서 지원서 접수${applyEnd ? ` (마감 ${applyEnd})` : ""}`, where: str(r.instNm) || undefined, url },
        place: [str(r.instNm), work].filter(Boolean).join(" ") || undefined,
        // 원문 링크가 "a, b"처럼 여러 개거나 공백이 섞여 오면 첫 번째 정상 주소만 쓴다
        url,
        source: "jobalio",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
      return withEligibility(opp, eligibility);
    });
}

export const jobalio: SourceAdapter = {
  id: "jobalio",
  domains: ["job", "parttime"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now, options = {}) {
    const key = process.env.DATA_GO_KR_KEY!;
    // 라이브 응답은 최대 2,000건, 일괄 수집은 최대 5,000건
    const url = (page: number) => `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&numOfRows=100&pageNo=${page}&resultType=json&ongoingYn=Y`;
    return fetchAllPages(
      "jobalio",
      100,
      options.full ? 50 : 20,
      (p) => {
        options.onRequest?.();
        return fetchJson(url(p));
      },
      (raw) => mapJobalio(raw, now),
    );
  },
};
