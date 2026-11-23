"use client";

import type { ScanSnapshot } from "@/lib/insight/types";
import type { Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";

const WEEK = 7 * 86_400_000;

/** 최근 7일 반복 조사 기록을 요약: 조사 횟수, 분야별 새 공고, 통과율 추이, 실패 출처 */
export function WeeklyReport({ history, now = new Date() }: { history: ScanSnapshot[]; now?: Date }) {
  const week = history.filter((h) => now.getTime() - new Date(h.at).getTime() <= WEEK);
  if (week.length === 0) {
    return <p className="text-xs text-slate-500">아직 조사 기록이 없습니다. 첫 자동 조사 후 이번 주 리포트가 생성됩니다.</p>;
  }
  const byDomain: Partial<Record<Domain, number>> = {};
  for (const h of week)
    for (const [d, n] of Object.entries(h.byDomainNew)) byDomain[d as Domain] = (byDomain[d as Domain] ?? 0) + (n ?? 0);
  const newTotal = week.reduce((a, h) => a + h.newCount, 0);
  const changedTotal = week.reduce((a, h) => a + (h.changedCount ?? 0), 0);
  const soonTotal = week.reduce((a, h) => a + (h.soonCount ?? 0), 0);
  const last = week.at(-1)!;
  const rate = last.total ? Math.round((last.passed / last.total) * 1000) / 10 : 0;
  const failed = [...new Set(week.flatMap((h) => h.failedSources))];
  const maxN = Math.max(1, ...Object.values(byDomain).map((n) => n ?? 0));

  return (
    <div className="space-y-2 text-sm">
      <p>
        이번 주 <b>{week.length}회</b> 조사해서 새 공고 <b>{newTotal}건</b>을 찾았습니다. 최근 조사에서는 전체 {last.total}건 중{" "}
        <b>{last.passed}건({rate}%)</b>이 내 조건을 통과했습니다.
      </p>
      {(changedTotal > 0 || soonTotal > 0) && (
        <p className="text-xs text-slate-600">
          마감일이 바뀐 공고 {changedTotal}건 · 마감 3일 이내로 들어온 공고 {soonTotal}건
        </p>
      )}
      {Object.keys(byDomain).length > 0 && (
        <ul className="space-y-1">
          {(Object.entries(byDomain) as [Domain, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([d, n]) => (
              <li key={d} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0">
                  {DOMAIN_META[d]?.label ?? d}
                </span>
                <span className="h-2 rounded-full bg-indigo-400" style={{ width: `${(n / maxN) * 60}%` }} />
                <span className="font-semibold">{n}</span>
              </li>
            ))}
        </ul>
      )}
      {failed.length > 0 && (
        <p className="text-xs text-amber-700">
          연결이 안 된 출처({failed.join(", ")})는 샘플 데이터로 대신 표시했습니다.
        </p>
      )}
    </div>
  );
}
