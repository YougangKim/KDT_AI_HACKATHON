// 브라우저 API에 의존하지 않는 순수 함수(테스트 대상)
import type { AnswerRecord, Domain, Match, Opportunity, Watch } from "@/lib/types";
import { getMatches } from "../engine";

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 마감까지 남은 날 수(오늘 마감 = 0, 지남 = 음수). 마감이 없으면(상시) null */
export function daysLeft(applyEnd: string | undefined, now: Date = new Date()): number | null {
  if (!applyEnd) return null;
  const end = new Date(applyEnd.length === 10 ? `${applyEnd}T00:00:00` : applyEnd);
  if (Number.isNaN(end.getTime())) return null;
  return Math.round((startOfDay(end) - startOfDay(now)) / DAY);
}

/** "D-3", "D-day", "마감", "상시" */
export function ddayLabel(applyEnd: string | undefined, now: Date = new Date()): string {
  const d = daysLeft(applyEnd, now);
  if (d === null) return "상시";
  if (d < 0) return "마감";
  if (d === 0) return "D-day";
  return `D-${d}`;
}

/** 게임 엔진과 같은 판정으로, 답변과 모순되는 조건이 있는 공고는 맞지 않는다(예·아니오·지역 포함 등 모두 반영) */
export function contradicts(opp: Opportunity, answers: AnswerRecord[]): boolean {
  return getMatches({ pool: [opp], answers }).length === 0;
}

function watched(w: Watch, opp: Opportunity): boolean {
  if (w.domains.length > 0 && !w.domains.includes(opp.domain)) return false;
  return !contradicts(opp, w.answers);
}

function notExpired(opp: Opportunity, now: Date): boolean {
  const d = daysLeft(opp.applyEnd, now);
  return d === null || d >= 0;
}

/** 저장한 조건에 맞는데 아직 보지 않은(seenIds에 없는) 공고 */
export function findNew(w: Watch, pool: Opportunity[], now: Date = new Date()): Opportunity[] {
  const seen = new Set(w.seenIds);
  return pool.filter((o) => !seen.has(o.id) && notExpired(o, now) && watched(w, o));
}

/** 저장한 조건에 맞고 마감이 withinDays일 이내로 남은 공고 */
export function findDeadlineSoon(
  w: Watch,
  pool: Opportunity[],
  now: Date = new Date(),
  withinDays = 3,
): Opportunity[] {
  return pool.filter((o) => {
    const d = daysLeft(o.applyEnd, now);
    return d !== null && d >= 0 && d <= withinDays && watched(w, o);
  });
}

/** 결과 화면의 답변·매칭으로 알림 조건을 만든다. 지금 보이는 공고는 '이미 본 것' */
export function buildWatch(answers: AnswerRecord[], matches: Match[], now: Date = new Date()): Watch {
  const domains = Array.from(new Set(matches.map((m) => m.opportunity.domain))) as Domain[];
  return {
    createdAt: now.toISOString(),
    answers,
    domains,
    seenIds: matches.map((m) => m.opportunity.id),
  };
}

export interface AlertItem {
  id: string; // `${kind}:${opportunity.id}` 중복 방지 키
  kind: "new" | "deadline";
  title: string;
  body: string;
  url: string;
  opportunityId: string;
  createdAt: string;
  read: boolean;
}

export function toAlert(kind: AlertItem["kind"], o: Opportunity, now: Date = new Date()): AlertItem {
  return {
    id: `${kind}:${o.id}`,
    kind,
    title: kind === "new" ? `새 공고 도착: ${o.title}` : `마감 임박 ${ddayLabel(o.applyEnd, now)}: ${o.title}`,
    body: `${o.org}${o.summary ? ` · ${o.summary}` : ""}`,
    url: o.url,
    opportunityId: o.id,
    createdAt: now.toISOString(),
    read: false,
  };
}

/** 이번에 새로 띄울 알림만 고른다(이미 기록에 있는 id는 제외) */
export function collectAlerts(
  w: Watch,
  pool: Opportunity[],
  log: AlertItem[],
  now: Date = new Date(),
): AlertItem[] {
  const had = new Set(log.map((a) => a.id));
  const items = [
    ...findNew(w, pool, now).map((o) => toAlert("new", o, now)),
    ...findDeadlineSoon(w, pool, now).map((o) => toAlert("deadline", o, now)),
  ];
  const out: AlertItem[] = [];
  for (const a of items) {
    if (had.has(a.id)) continue;
    had.add(a.id);
    out.push(a);
  }
  return out;
}
