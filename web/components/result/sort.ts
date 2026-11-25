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

// 기관·시설 이름 속 "장애인·보훈"(보훈병원, 장애인고용공단, 장애인 쉼터 등)은 대상 제한이 아니다
const TARGET_ORG = /\S*(보훈병원|보훈요양원|보훈재활체육센터|보훈복지의료공단|장애인고용공단|직업능력개발원|장애인직업재활시설|장애인(사회적응)?지원센터|장애인쉼터|장애아동\S*쉼터|장애인치과병원|장애인단기거주시설|장애인보건의료센터)\S*/g;
const TARGET = [
  /(장애인|보훈|국가유공자|북한이탈주민)\s*(제한|전형|특별|전용|한정|대상)/, // 장애인 제한, 보훈특별고용, 보훈제한경쟁
  /제한경쟁[_\s]*(장애인|보훈)|(보훈|장애인)\s*·\s*(장애인|보훈)\s*제한/, // 제한경쟁_장애인, 보훈·장애인 제한경쟁
  /[,(\[_-]\s*(장애인|보훈)\s*(?=[)\]_(])/, // (장애인), 서비스지원직(보훈), 기간제, 장애인), 단시간근로자-장애인(물류팀)
  /장애전형|장애인\s*(바리스타|근로자|고용원|단시간|체험형|미술작가|연주단)/,
];

/** 장애인·보훈 등 특정 대상만 지원할 수 있는 공고(제목 표시 기준). 대상 여부를 묻지 않으므로 빼지 않고 뒤로 보낸다. "(일반/보훈)" 같은 혼합 채용은 제외 */
export function restrictedTarget(title: string | undefined, domain?: string): boolean {
  if (!title) return false;
  // 지원금은 제목에 대상이 드러나면 그 대상 전용(장애인 장학금, 독립유공자 수당, 북한이탈주민 정착 지원)
  if (domain === "benefit" && /장애|유공자|북한이탈|탈북|보훈대상/.test(title)) return true;
  const t = title.replace(TARGET_ORG, " ");
  return TARGET.some((re) => re.test(t));
}

/** 바로 신청 → 특정 대상 제한 아님 → 내 지역 근무(전국 공고) → 마감 임박 순 */
export function sortMatches(ms: Match[], region: string | null): Match[] {
  const rank = (m: Match) => {
    const d = daysLeft(m.opportunity.applyEnd);
    return d === null ? 9999 : d < 0 ? 99999 : d;
  };
  return [...ms].sort(
    (a, b) =>
      Number(a.status !== "eligible") - Number(b.status !== "eligible") ||
      Number(restrictedTarget(a.opportunity.title, a.opportunity.domain)) - Number(restrictedTarget(b.opportunity.title, b.opportunity.domain)) ||
      Number(farWorkplace(a, region)) - Number(farWorkplace(b, region)) ||
      rank(a) - rank(b),
  );
}

/**
 * 전체 탭에서 분야가 여러 개면 분야별 순서를 지키며 번갈아 섞는다.
 * (지원금처럼 수가 많은 분야가 상위를 모두 차지해 다른 분야가 안 보이는 문제 방지)
 * 분야 안의 순서는 보존하되 자격 확인 상태 때문에 다른 분야가 뒤로 밀리지 않게 합니다.
 */
export function interleaveByDomain(ms: Match[]): Match[] {
  const mix = (list: Match[]) => {
    const groups = new Map<string, Match[]>();
    for (const m of list) {
      const g = groups.get(m.opportunity.domain) ?? [];
      g.push(m);
      groups.set(m.opportunity.domain, g);
    }
    if (groups.size < 2) return list;
    const queues = [...groups.values()];
    const out: Match[] = [];
    for (let i = 0; out.length < list.length; i++) {
      for (const q of queues) if (q[i]) out.push(q[i]);
    }
    return out;
  };
  return mix(ms);
}

export type SortMode = "relevance" | "deadline" | "roomy";
export const SORT_LABEL: Record<SortMode, string> = { relevance: "관련도순", deadline: "마감 임박순", roomy: "기한 넉넉한 최신순" };

/**
 * 사용자가 고른 정렬. relevance는 기존 순서(바로 신청 → 내 지역 → 마감·거리 → 분야 섞기)를 그대로 쓴다.
 * - deadline: 마감이 가까운 순(상시·마감 미상은 뒤)
 * - roomy: 마감까지 14일 이상 남았거나 상시인 공고를 먼저, 그 안에서 최근 시작(게시)한 순
 */
export function applySortMode(ms: Match[], mode: SortMode): Match[] {
  if (mode === "relevance") return ms;
  const left = (m: Match) => daysLeft(m.opportunity.applyEnd);
  if (mode === "deadline") {
    return [...ms].sort((a, b) => (left(a) ?? 99999) - (left(b) ?? 99999));
  }
  const roomy = (m: Match) => { const d = left(m); return d === null || d >= 14; };
  const start = (m: Match) => m.opportunity.applyStart ?? "";
  return [...ms].sort((a, b) => Number(roomy(b)) - Number(roomy(a)) || start(b).localeCompare(start(a)) || (left(b) ?? 99999) - (left(a) ?? 99999));
}
