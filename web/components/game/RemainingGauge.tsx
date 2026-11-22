"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./game.module.css";

/** 질문 진행률과 남은 후보 수. 후보 숫자가 줄어드는 카운트다운과 "-N" 팝업. */
export default function RemainingGauge({ remaining, total, question, estimate }: { remaining: number; total: number; question: number; estimate: number }) {
  const [shown, setShown] = useState(remaining);
  const [drop, setDrop] = useState<{ n: number; key: number } | null>(null);
  const prev = useRef(remaining);

  useEffect(() => {
    const from = prev.current;
    prev.current = remaining;
    if (from === remaining) return;
    if (remaining < from) setDrop({ n: from - remaining, key: Date.now() });
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      setShown(Math.round(from + (remaining - from) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [remaining]);

  const progress = estimate > 0 ? Math.min(100, (question / estimate) * 100) : 0;

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-slate-700">질문 {question}</span>
          <span className="text-slate-500">약 {estimate}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <span className="block h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-baseline justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
        <span className="text-sm font-medium text-slate-600">남은 후보</span>
        <span className="relative font-bold tabular-nums text-slate-900">
          {shown}개 <span className="font-medium text-slate-400">/ {total}</span>
          {drop && (
            <span key={drop.key} className={`${styles.dropPop} absolute -top-5 right-0 text-sm font-semibold text-rose-500`}>
              −{drop.n}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
