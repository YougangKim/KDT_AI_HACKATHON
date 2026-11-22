"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMatches } from "@/lib/engine";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { AnalysisView } from "@/components/result/AnalysisView";
import { readLastResult, type LastResult } from "@/components/result/lastResult";

/** 궁금할 때만 여는 분석 화면: 통과율, 내 조건, 병목, 조건별 탈락, 분야별 */
export default function AnalysisPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [hard, setHard] = useState<string[]>([]);
  const [toast, setToast] = useState("");

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
    const answers = result.answers.map((a) => (a.question.id === questionId ? { ...a, answer: "unknown" as const } : a));
    const next = { answers, matches: getMatches({ pool: result.pool, answers }), pool: result.pool };
    setResult(next);
    try {
      sessionStorage.setItem("lastResult", JSON.stringify(next));
    } catch {}
    setToast(`+${next.matches.length - (result.matches.length ?? 0)}개 늘었어요`);
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
        <AnalysisView report={report} answers={result?.answers ?? []} sampleCount={sampleCount} onRelax={onRelax} onKeep={onKeep} />
      ) : (
        <p className="py-16 text-center text-slate-500">분석할 결과가 없어요.</p>
      )}

      {toast && <p className="text-center text-sm font-semibold text-indigo-700">{toast}</p>}

      <Link href="/result" className="mt-auto rounded-2xl bg-indigo-600 py-3 text-center font-semibold text-white">
        공고 보기
      </Link>
    </main>
  );
}
