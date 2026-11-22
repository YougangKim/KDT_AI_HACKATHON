"use client";

import type { Relaxation } from "@/lib/insight/types";

/** 결과가 적을 때: 어떤 조건을 풀면 몇 건 늘어나는지, 누르면 바로 반영 */
export function RelaxSuggestions({
  options,
  onRelax,
  title = "이 조건을 풀면 더 보여요",
}: {
  options: Relaxation[];
  onRelax: (questionId: string) => void;
  title?: string;
}) {
  if (options.length === 0) return null;
  return (
    <section className="space-y-2 rounded-3xl bg-amber-50 p-4" aria-label="조건 완화 제안">
      <p className="text-sm font-bold text-amber-900">{title}</p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.step.questionId}>
            <button
              type="button"
              onClick={() => onRelax(o.step.questionId)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm shadow-sm active:scale-[0.98]"
            >
              <span className="break-keep text-slate-800">{o.suggestion}</span>
              <span className="shrink-0 text-right">
                <span className="block font-black text-emerald-600">+{o.gain}</span>
                <span className="block text-[10px] text-slate-400">확인 필요 포함</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-amber-800">누르면 그 답을 &lsquo;모름&rsquo;으로 바꿔 확인 필요 공고까지 보여 줘요.</p>
    </section>
  );
}
