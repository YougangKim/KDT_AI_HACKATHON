"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { AnalysisView } from "@/components/result/AnalysisView";
import { readLastResult, relaxAnswer, type LastResult } from "@/components/result/lastResult";
import { Icon } from "@/components/brand/Icons";

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
    const next = relaxAnswer(result, questionId);
    setResult(next);
    setToast(`+${next.matches.length - result.matches.length}개 늘었어요`);
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

      {report ? (
        <AnalysisView
          report={report}
          answers={result?.answers ?? []}
          sampleCount={sampleCount}
          onRelax={onRelax}
        />
      ) : (
        <p className="py-16 text-center text-slate-500">분석할 결과가 없어요.</p>
      )}

      {toast && <p role="status" className="text-center text-sm font-semibold text-indigo-700">{toast}</p>}

      <Link href="/result" className="mt-auto rounded-2xl bg-indigo-600 py-3 text-center font-semibold text-white">
        공고 보기
      </Link>
    </main>
  );
}
