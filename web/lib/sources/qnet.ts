// 국가자격 시험일정 (한국산업인력공단, data.go.kr 15074408) — 원서접수 기간을 공고로 본다
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, pickArray, str, toIsoDate } from "./util";

const ENDPOINT = "https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList";

export function mapQnet(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["body", "items"], ["response", "body", "items", "item"], ["body", "items", "item"]]);
  const out: Opportunity[] = [];
  for (const r of items) {
    const desc = str(r.description) || [str(r.qualgbNm), str(r.implYy) && `${str(r.implYy)}년`, str(r.implSeq) && `${str(r.implSeq)}회`].filter(Boolean).join(" ");
    if (!desc) continue;
    const base = `${str(r.implYy)}-${str(r.qualgbCd)}-${str(r.implSeq)}`;
    const stages: [string, unknown, unknown, unknown][] = [
      ["필기", r.docRegStartDt, r.docRegEndDt, r.docExamStartDt],
      ["실기", r.pracRegStartDt, r.pracRegEndDt, r.pracExamStartDt],
    ];
    for (const [stage, s, e, exam] of stages) {
      const applyEnd = toIsoDate(e);
      if (!applyEnd) continue;
      const examDay = toIsoDate(exam);
      out.push({
        id: `qnet:${base}-${stage}`,
        domain: "exam",
        title: `${desc} ${stage} 원서접수`,
        org: "한국산업인력공단",
        region: [],
        summary: examDay ? `${stage}시험 ${examDay}부터` : `${stage}시험 원서접수`,
        conditions: buildConditions("exam", [], ""),
        applyStart: toIsoDate(s),
        applyEnd,
        url: "https://www.q-net.or.kr/",
        source: "qnet",
        isSample: false,
        fetchedAt: now.toISOString(),
      });
    }
  }
  return out;
}

export const qnet: SourceAdapter = {
  id: "qnet",
  domains: ["exam"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = process.env.DATA_GO_KR_KEY!;
    const year = new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
    const pages = await Promise.all(
      [year, year + 1].map(async (y) =>
        mapQnet(await fetchJson(`${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&numOfRows=50&pageNo=1&dataFormat=json&implYy=${y}&qualgbCd=T`), now),
      ),
    );
    return pages.flat();
  },
};
