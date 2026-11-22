"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { AnalysisView } from "@/components/result/AnalysisView";
import { readLastResult, relaxAnswer, type LastResult } from "@/components/result/lastResult";
import { RelaxSuggestions } from "@/components/result/RelaxSuggestions";
import { RemovedByQuestion } from "@/components/result/RemovedByQuestion";

/** 궁금할 때만 여는 분석 화면: 통과율, 내 조건, 병목, 조건별 탈락, 분야별 */
export default function AnalysisPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [hard, setHard] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [step, setStep] = useState("");
  function pickStep(id: string) {
    setStep(id);
    setTimeout(() => document.getElementById("removed-by-question")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  useEffect(() => {
    setResult(readLastResult());
    try {
      setHard(JSON.parse(localStorage.getItem("hardConditions") ?? "[]"));
    } catch {}
  }, []);

  const report = useMemo(
    () => (result?.pool?.length ? analyzeFunnel(result.pool, result.answers, hard) : null),
    [result, hard],
  );
  const sampleCount = useMemo(() => new Set((result?.pool ?? []).filter((o) => o.isSample).map((o) => o.source)).size, [result]);

  function onRelax(questionId: string) {
    if (!result?.pool) return;
    const next = relaxAnswer(result, questionId);
    setResult(next);
    setToast(`+${next.matches.length - result.matches.length}개 늘었어요`);
  }

  function onKeep(questionId: string) {
    const next = [...new Set([...hard, questionId])];
    setHard(next);
    try {
      localStorage.setItem("hardConditions", JSON.stringify(next));
    } catch {}
    setToast("유지할게요");
  }

  if (result === undefined) return null;

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/result" className="text-sm text-slate-500">
          ← 결과로
        </Link>
        <h1 className="text-base font-bold">📊 분석</h1>
        <span className="w-12" />
      </header>

      {report ? (
        <AnalysisView report={report} answers={result?.answers ?? []} sampleCount={sampleCount} onRelax={onRelax} onKeep={onKeep} onPickStep={pickStep} />
      ) : (
        <p className="py-16 text-center text-slate-500">분석할 결과가 없어요.</p>
      )}

      {report && result?.pool && <RemovedByQuestion steps={report.steps} pool={result.pool} active={step} onSelect={setStep} />}

      {report && report.relaxOptions.length > 1 && <RelaxSuggestions options={report.relaxOptions} onRelax={onRelax} title="다른 완화 방법" />}

      {toast && <p className="text-center text-sm font-semibold text-indigo-700">{toast}</p>}

      <Link href="/result" className="mt-auto rounded-2xl bg-indigo-600 py-3 text-center font-semibold text-white">
        공고 보기
      </Link>
    </main>
  );
}
