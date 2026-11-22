import { daysLeft } from "@/lib/alerts";
import type { AnswerRecord, Match } from "@/lib/types";

/** 사용자가 "예"라고 답한 지역(없으면 null) */
export function myRegion(answers: AnswerRecord[]): string | null {
  const r = answers.find((a) => a.question.attr === "region" && a.question.op === "eq" && a.answer === "yes");
  return r ? String(r.question.value) : null;
}

/** 전국 지원 가능 공고 중 근무지가 적혀 있고 그게 내 지역이 아닌 것(근무지 정보가 없으면 불이익 없음) */
function farWorkplace(m: Match, region: string | null): boolean {
  const o = m.opportunity;
  if (!region || o.region.length > 0) return false;
  const work = o.summary.match(/근무지 ([^/]+)/)?.[1];
  return !!work && !work.includes(region);
}

/** 바로 신청 → 내 지역 근무(전국 공고) → 마감 임박 순 */
export function sortMatches(ms: Match[], region: string | null): Match[] {
  const rank = (m: Match) => {
    const d = daysLeft(m.opportunity.applyEnd);
    return d === null ? 9999 : d < 0 ? 99999 : d;
  };
  return [...ms].sort(
    (a, b) =>
      Number(a.status !== "eligible") - Number(b.status !== "eligible") ||
      Number(farWorkplace(a, region)) - Number(farWorkplace(b, region)) ||
      rank(a) - rank(b),
  );
}
