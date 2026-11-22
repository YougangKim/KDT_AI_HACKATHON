// 반복 조사에서 "새 공고" 말고도 알려야 할 변화: 마감일 변경, 마감 임박(D-3 이내, 공고당 1회)
import { daysLeft } from "@/lib/alerts/core";
import type { Opportunity } from "@/lib/types";

/** 공고별로 마지막으로 본 마감일과 D-3 알림 발송 여부 */
export type Known = Record<string, { end?: string; d3?: boolean }>;

export interface Changes {
  changed: { opp: Opportunity; from?: string; to?: string }[];
  soon: Opportunity[];
  known: Known;
}

const MAX_KNOWN = 500;

/** matched: 사용자 조건에 맞는 현재 공고들. known: 직전 조사까지의 기록 */
export function detectChanges(matched: Opportunity[], known: Known = {}, now = new Date()): Changes {
  const changed: Changes["changed"] = [];
  const soon: Opportunity[] = [];
  const next: Known = {};
  for (const o of matched) {
    const prev = known[o.id];
    const entry = { end: o.applyEnd, d3: prev?.d3 ?? false };
    if (prev && prev.end !== o.applyEnd && (prev.end || o.applyEnd)) changed.push({ opp: o, from: prev.end, to: o.applyEnd });
    const d = daysLeft(o.applyEnd, now);
    if (d !== null && d >= 0 && d <= 3 && !entry.d3) {
      soon.push(o);
      entry.d3 = true;
    }
    next[o.id] = entry;
  }
  // 지금 안 보이는 공고 기록도 잠시 유지(출처 일시 오류로 사라졌다 돌아오는 경우), 전체 상한
  for (const [id, v] of Object.entries(known)) if (!(id in next)) next[id] = v;
  const ids = Object.keys(next);
  if (ids.length > MAX_KNOWN) for (const id of ids.slice(0, ids.length - MAX_KNOWN)) delete next[id];
  return { changed, soon, known: next };
}

/** 푸시 한 건으로 묶은 문구 */
export function pushSummary(fresh: Opportunity[], changes: Pick<Changes, "changed" | "soon">) {
  const parts: string[] = [];
  if (fresh.length) parts.push(`새 공고 ${fresh.length}건`);
  if (changes.changed.length) parts.push(`마감 변경 ${changes.changed.length}건`);
  if (changes.soon.length) parts.push(`마감 임박 ${changes.soon.length}건`);
  const titles = [...changes.soon, ...fresh, ...changes.changed.map((c) => c.opp)].map((o) => o.title);
  return { title: parts.join(" · "), body: [...new Set(titles)].slice(0, 3).join(" · ").slice(0, 200) };
}

export function digestSummary(total: number, deadlineSoon: number) {
  return {
    title: "My News 정기 요약",
    body: `오늘 조건에 맞는 공고 ${total}개, 마감 임박 ${deadlineSoon}개`,
  };
}
