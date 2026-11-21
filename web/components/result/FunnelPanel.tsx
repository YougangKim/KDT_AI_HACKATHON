"use client";

import type { FunnelReport } from "@/lib/insight/types";
import type { Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";

/** 전체 중 몇 %가 통과했는지 + 조건별 탈락 막대 + 병목 조건 완화 제안(타협 불가면 확인 질문) */
export function FunnelPanel({
  report,
  summary,
  sampleSources = [],
  onRelax,
  onKeep,
}: {
  report: FunnelReport;
  summary: string;
  sampleSources?: string[];
  onRelax: (questionId: string) => void;
  onKeep: (questionId: string) => void;
}) {
  const pct = Math.round(report.passRate * 1000) / 10;
  const max = Math.max(1, ...report.steps.map((s) => s.aloneRemoved));
  const b = report.bottleneck;

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 text-slate-900 shadow-sm">
      <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm leading-relaxed break-keep">
        <span className="mr-1 font-semibold text-indigo-700">내 조건</span>
        {summary}
      </p>

      <div>
        <p className="text-sm text-slate-500">조사한 공고 {report.total}건 중</p>
        <p className="text-2xl font-bold">
          {report.passed}건 통과 <span className="text-base font-semibold text-indigo-600">({pct}%)</span>
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {(Object.entries(report.byDomain) as [Domain, { total: number; passed: number }][])
            .filter(([, v]) => v.total > 0)
            .map(([d, v]) => `${DOMAIN_META[d]?.label ?? d} ${v.passed}/${v.total}`)
            .join(" · ")}
        </p>
        {sampleSources.length > 0 && (
          <p className="mt-1 text-xs text-amber-700 break-keep">
            ⚠ {sampleSources.length}개 출처는 아직 연결되지 않아 예시 데이터로 대신 보여 줘요. 0건이어도 실제로 공고가 없다는 뜻은 아니에요.
          </p>
        )}
      </div>

      {report.steps.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">어떤 조건이 가장 많이 걸러 냈나요?</h3>
          <ul className="space-y-1.5">
            {report.steps.slice(0, 5).map((s) => (
              <li key={s.questionId} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate">
                    {s.hard && <span className="mr-1 text-slate-400">🔒</span>}
                    {s.label}
                  </span>
                  <span className="shrink-0 font-semibold text-rose-600">−{s.aloneRemoved}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-slate-100" aria-hidden>
                  <div
                    className={`h-full rounded-full ${b?.step.questionId === s.questionId ? "bg-rose-500" : "bg-slate-300"}`}
                    style={{ width: `${(s.aloneRemoved / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {b && (
        <div className={`space-y-2 rounded-xl p-3 text-sm ${report.scarce ? "bg-rose-50" : "bg-amber-50"}`}>
          <p className="font-semibold break-keep">
            {report.scarce ? "결과가 너무 적어요. " : ""}
            {b.suggestion}
          </p>
          <p className="text-xs text-slate-600 break-keep">이 조건은 꼭 지켜야 하나요?</p>
          <div className="flex gap-2">
            <button
              onClick={() => onRelax(b.step.questionId)}
              className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white"
            >
              풀어서 +{b.gain}건 보기
            </button>
            <button
              onClick={() => onKeep(b.step.questionId)}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold"
            >
              꼭 지켜야 해요
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
