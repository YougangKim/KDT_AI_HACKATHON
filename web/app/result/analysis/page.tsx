"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { AnalysisView } from "@/components/result/AnalysisView";
import { readLastResult, relaxAnswer, saveLastResult, type LastResult } from "@/components/result/lastResult";
import { Icon } from "@/components/brand/Icons";
import { ConditionEditor } from "@/components/result/ConditionEditor";
import { setAnswers } from "@/components/result/lastResult";
import type { AnswerChange } from "@/lib/engine/answer-groups";
import { DOMAIN_META } from "@/components/result/domain";
import { OpportunityInsights } from "@/components/result/OpportunityInsights";
import type { Domain } from "@/lib/types";
import { ContextNews } from "@/components/result/ContextNews";

export default function AnalysisPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [hard, setHard] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<Domain | "all">("all");
  const [previous, setPrevious] = useState<LastResult[]>([]);

  useEffect(() => {
    setResult(readLastResult());
    try {
      setHard(JSON.parse(localStorage.getItem("hardConditions") ?? "[]"));
    } catch {}
  }, []);

  const report = useMemo(
    () => (result?.pool?.length ? analyzeFunnel(result.pool.filter((o) => tab === "all" || o.domain === tab), result.answers, hard) : null),
    [result, hard, tab],
  );
  const sampleCount = useMemo(() => new Set((result?.pool ?? []).filter((o) => o.isSample).map((o) => o.source)).size, [result]);

  function onRelax(questionId: string) {
    if (!result?.pool) return;
    const next = relaxAnswer(result, questionId);
    setPrevious((history) => [...history, result]);
    setResult(next);
    setToast(`+${next.matches.length - result.matches.length}개 늘었습니다`);
  }

  function edit(changes: AnswerChange[]) {
    if (!result) return;
    setPrevious((history) => [...history, result]);
    setResult(setAnswers(result, changes));
    setToast("조건을 변경했습니다. 변경 취소로 복구할 수 있습니다.");
  }

  function undo() {
    const last = previous.at(-1);
    if (!last) return;
    saveLastResult(last);
    setResult(last);
    setPrevious((history) => history.slice(0, -1));
    setToast("이전 조건으로 복구했습니다.");
  }

  if (result === undefined) return null;

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/result" className="text-sm text-slate-500">
          ← 결과로
        </Link>
        <h1 className="flex items-center gap-1 text-base font-bold"><Icon name="analysis" className="h-5 w-5" />분석</h1>
        <span className="w-12" />
      </header>

      <nav aria-label="분석 분야" className="flex flex-wrap gap-2">
        {(["all", ...Object.keys(DOMAIN_META)] as const).map((domain) => (
          <button key={domain} aria-pressed={tab === domain} onClick={() => setTab(domain as Domain | "all")} className={`rounded-xl border px-3 py-2 text-sm ${tab === domain ? "bg-indigo-600 text-white" : "bg-white"}`}>
            {domain === "all" ? "전체" : DOMAIN_META[domain as Domain].label}
          </button>
        ))}
      </nav>
      {result && <OpportunityInsights result={result} domain={tab} />}
      {result && (
        <section id="conditions" className="space-y-3 scroll-mt-4">
          <h2 className="font-bold">조건 수정</h2>
          <button disabled={!previous.length} onClick={undo} className="rounded-xl border px-4 py-3 disabled:opacity-40">변경 취소</button>
          <details className="app-card p-4"><summary className="cursor-pointer font-semibold">전체 답변 수정</summary>
            <ConditionEditor answers={result.answers} onChange={edit} />
          </details>
        </section>
      )}
      {report ? (
        <AnalysisView
          report={report}
          answers={result?.answers ?? []}
          sampleCount={sampleCount}
          onRelax={onRelax}
        />
      ) : (
        <p className="py-16 text-center text-slate-500">분석할 결과가 없습니다.</p>
      )}

      {(() => {
        // 전체 탭은 결과에 있는 분야 전부, 검색어는 인터뷰 답(지역·상태·직무·필요한 지원 등)에서 뽑는다
        const doms = tab !== "all" ? [tab] : Array.from(new Set((result?.matches ?? []).map((m) => m.opportunity.domain))).slice(0, 3);
        const keywords = Array.from(new Set((result?.answers ?? [])
          .filter((a) => a.answer === "yes" && ["region", "employment", "field", "housingKind", "need"].includes(a.question.attr))
          .flatMap((a) => (Array.isArray(a.question.value) ? a.question.value : [a.question.value]).map(String))
          .filter((v) => v && v.length <= 12))).slice(0, 4).join(" ");
        return doms.length ? <ContextNews key={`${tab}|${keywords}`} domains={doms as Domain[]} keywords={keywords} /> : null;
      })()}
      {toast && <p role="status" className="text-center text-sm font-semibold text-indigo-700">{toast}</p>}

      <Link href="/result" className="mt-auto rounded-2xl bg-indigo-600 py-3 text-center font-semibold text-white">
        공고 보기
      </Link>
    </main>
  );
}
