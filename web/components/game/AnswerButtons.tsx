"use client";

import type { Answer } from "@/lib/types";

const BUTTONS: { a: Answer; label: string; cls: string }[] = [
  { a: "yes", label: "예", cls: "bg-indigo-600 text-white shadow-indigo-200" },
  { a: "no", label: "아니오", cls: "bg-white text-slate-900 ring-1 ring-slate-300" },
  { a: "unknown", label: "모르겠어요", cls: "bg-slate-100 text-slate-700" },
];

export default function AnswerButtons({ onAnswer, disabled }: { onAnswer: (a: Answer) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BUTTONS.map((b) => (
        <button
          key={b.a}
          type="button"
          disabled={disabled}
          onClick={() => onAnswer(b.a)}
          className={`${b.cls} ${b.a === "unknown" ? "col-span-2 min-h-12 py-3 text-base" : "min-h-20 py-5 text-xl"} rounded-2xl font-bold shadow-sm active:scale-[0.98] disabled:opacity-50`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
