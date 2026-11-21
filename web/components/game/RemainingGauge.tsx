"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./game.module.css";

/** "남은 후보 N개" 게이지. 숫자가 줄어드는 카운트다운과 "-N" 팝업. */
export default function RemainingGauge({ remaining, total }: { remaining: number; total: number }) {
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

  const pct = total > 0 ? Math.max(4, (remaining / total) * 100) : 0;
  const color = remaining <= 5 ? "bg-emerald-500" : remaining <= total / 2 ? "bg-indigo-500" : "bg-indigo-300";

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-end justify-between">
        <span className="text-sm text-slate-500">남은 후보</span>
        <span className="relative text-2xl font-bold tabular-nums">
          {shown}
          <span className="text-base font-medium text-slate-400">개 / {total}</span>
          {drop && (
            <span key={drop.key} className={`${styles.dropPop} absolute -top-5 right-0 text-sm font-semibold text-rose-500`}>
              −{drop.n}
            </span>
          )}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={`${styles.bar} h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
