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
        apply: { how: "Q-Net 원서접수", url: "https://www.q-net.or.kr" },
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
  async fetch(now, options = {}) {
    const key = process.env.DATA_GO_KR_KEY!;
    const year = new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
    // 국가기술(T)·국가전문(S)·과정평가형(C)·일학습병행(W) 자격의 올해·내년 회차 전부(한 번에 50건까지라 2쪽씩)
    const grades = ["T", "S", "C", "W"];
    const pages = await Promise.all(
      [year, year + 1].flatMap((y) => grades.flatMap((g) => [1, 2].map((page) => {
        options.onRequest?.();
        return fetchJson(`${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&numOfRows=50&pageNo=${page}&dataFormat=json&implYy=${y}&qualgbCd=${g}`)
          .then((raw) => mapQnet(raw, now))
          .catch(() => [] as Opportunity[]); // 내년 일정이 아직 없으면 빈 결과
      }))),
    );
    return pages.flat();
  },
};
