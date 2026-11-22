"use client";

import type { Answer, AnswerRecord } from "@/lib/types";

const CHOICES: { a: Answer; label: string }[] = [
  { a: "yes", label: "예" },
  { a: "no", label: "아니오" },
  { a: "unknown", label: "모름" },
];

/** 내가 한 답을 한눈에 보고 하나씩 바꾼다(바꾸면 결과가 바로 다시 계산됨) */
export function ConditionEditor({ answers, onChange }: { answers: AnswerRecord[]; onChange: (questionId: string, a: Answer) => void }) {
  if (answers.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="내 조건">
      {answers.map((r) => (
        <li key={r.question.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
          <span className="text-sm text-slate-700 break-keep">{r.question.text}</span>
          <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200" role="group" aria-label={r.question.text}>
            {CHOICES.map((c) => (
              <button
                key={c.a}
                type="button"
                aria-pressed={r.answer === c.a}
                onClick={() => r.answer !== c.a && onChange(r.question.id, c.a)}
                className={`px-2.5 py-1.5 text-xs font-semibold ${r.answer === c.a ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}
              >
                {c.label}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
