"use client";

import { useState } from "react";
import type { FilterStep } from "@/lib/insight/types";
import type { Opportunity } from "@/lib/types";
import { chipOf } from "./AnalysisView";

const SHOW = 15;

/** 질문(답)마다 탭: 그 답 때문에 빠진 공고와 걸린 조건 원문 */
export function RemovedByQuestion({ steps, pool, active: controlled, onSelect }: { steps: FilterStep[]; pool: Opportunity[]; active?: string; onSelect?: (id: string) => void }) {
  const tabs = steps.filter((s) => s.removedIds.length > 0);
  const [own, setOwn] = useState(""); // 처음엔 닫아 두고, 탭이나 위 막대를 누르면 펼친다
  const active = controlled || own;
  const setActive = (id: string) => (onSelect ? onSelect(id) : setOwn(id));
  const [more, setMore] = useState(false);
  if (tabs.length === 0) return null;
  const step = tabs.find((t) => t.questionId === active);
  const byId = new Map(pool.map((o) => [o.id, o]));
  const removed = (step?.removedIds ?? []).map((id) => byId.get(id)).filter((o): o is Opportunity => !!o);
  const reason = (o: Opportunity) =>
    o.conditions.find((c) => c.attr === step?.attr)?.rawText ?? (step?.attr === "region" ? `대상 지역: ${o.region.join("·")}` : step?.attr === "interest" ? "다른 분야" : "");

  return (
    <section id="removed-by-question" className="space-y-3 rounded-3xl bg-white p-5 shadow-sm" aria-label="질문별 탈락 공고">
      <p className="text-xs font-semibold text-slate-500">질문별로 빠진 공고</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.questionId}
            role="tab"
            aria-selected={t.questionId === step?.questionId}
            onClick={() => {
              setActive(t.questionId);
              setMore(false);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${t.questionId === step?.questionId ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {chipOf(t.answer) ?? t.label} −{t.removedIds.length}
          </button>
        ))}
      </div>
      {!step ? (
        <p className="text-xs text-slate-400">조건을 누르면 그 답 때문에 빠진 공고가 표시됩니다.</p>
      ) : (
        <>
      <p className="text-xs text-slate-500 break-keep" role="tabpanel">
        &ldquo;{step.answer.question.text}&rdquo; → {step.answer.answer === "yes" ? "예" : "아니오"} 때문에 {removed.length}개가 제외됐습니다.
      </p>
      <ul className="space-y-2">
        {(more ? removed : removed.slice(0, SHOW)).map((o) => (
          <li key={o.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <a href={o.url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-slate-800 break-keep">
              {o.title}
            </a>
            <p className="text-[11px] text-rose-600">{reason(o)}</p>
          </li>
        ))}
      </ul>
      {!more && removed.length > SHOW && (
        <button onClick={() => setMore(true)} className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600">
          {removed.length - SHOW}개 더 보기
        </button>
      )}
        </>
      )}
    </section>
  );
}
