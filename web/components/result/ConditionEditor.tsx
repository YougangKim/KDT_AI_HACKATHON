"use client";

import { useState } from "react";
import type { AnswerRecord } from "@/lib/types";
import { answerGroups, numericChanges, numericRange, type AnswerChange } from "@/lib/engine/answer-groups";
import { DOMAIN_META } from "./domain";
import { PaginatedList } from "@/components/PaginatedList";

type Props = { answers: AnswerRecord[]; onChange: (changes: AnswerChange[]) => void };
const LABELS: Record<string, string> = { age: "만 나이", incomePct: "기준중위소득 비율", region: "거주 지역", employment: "취업 상태", education: "최종 학력", interest: "관심 분야", field: "직무 분야", need: "필요한 지원", housingKind: "주거 형태" };
const VALUES: Record<string, string> = { student: "학생", jobseeker: "구직 중", employed: "재직 중", parttime: "알바", rent: "임대", sale: "분양", "1": "고졸 이하", "2": "전문대졸", "3": "대졸", "4": "석사", "5": "박사", ...Object.fromEntries(Object.entries(DOMAIN_META).map(([key, v]) => [key, v.label])) };

function NumericControl({ group, onChange }: { group: AnswerRecord[]; onChange: Props["onChange"] }) {
  const age = group[0].question.attr === "age";
  const unit = age ? "세" : "%";
  const [lo, hi] = numericRange(group);
  const [value, setValue] = useState(lo ?? hi ?? (age ? 25 : 100));
  const max = age ? 100 : Math.max(300, ...group.map((a) => Number(a.question.value)));
  const current = lo === null && hi === null ? "모름" : lo === hi ? `${lo}${unit}` : lo === null ? `${hi}${unit} 이하` : hi === null ? `${lo}${unit} 이상` : `${lo}~${hi}${unit}`;
  const label = age ? "만 나이" : "기준중위소득 비율";
  const shift = age ? 5 : 10;
  return <div className="space-y-3" role="group" aria-label={label}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{label}</span><span className="text-xs text-slate-500">현재 {current}</span></div>
    <div className="flex items-center gap-3">
      <button type="button" aria-label={`${label} ${shift}${unit} 감소`} onClick={() => setValue(Math.max(0, value - shift))} className="min-h-11 rounded-lg border px-3">−{shift}{unit}</button>
      <output className="flex-1 text-center text-lg font-bold">{value}{unit}</output>
      <button type="button" aria-label={`${label} ${shift}${unit} 증가`} onClick={() => setValue(Math.min(max, value + shift))} className="min-h-11 rounded-lg border px-3">+{shift}{unit}</button>
    </div>
    <input aria-label={label} type="range" min={0} max={max} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-indigo-600" />
    <div className="flex gap-2"><button type="button" onClick={() => onChange(numericChanges(group, value))} className="min-h-11 flex-1 rounded-lg bg-indigo-600 px-3 text-white">{value}{unit} 적용</button><button type="button" onClick={() => onChange(numericChanges(group, null))} className="min-h-11 rounded-lg border px-3">모름</button></div>
  </div>;
}

export function ConditionEditor({ answers, onChange }: Props) {
  return <PaginatedList label="내 조건" className="space-y-3">
    {answerGroups(answers).map((group) => {
      const attr = group[0].question.attr;
      if (attr === "topic") return <li key={group[0].question.id} className="rounded-xl bg-white p-4" role="group" aria-label={group[0].question.text.split(" — ")[0]}>
        <p className="mb-2 font-semibold">{group[0].question.text.split(" — ")[0]}</p>
        <div className="flex flex-wrap gap-2">{group.map((r) => <button key={r.question.id} type="button" aria-pressed={r.answer === "yes"} onClick={() => onChange(group.map((a) => ({ id: a.question.id, answer: a === r ? "yes" : "no" })))} className={`min-h-11 rounded-lg border px-3 text-sm ${r.answer === "yes" ? "bg-indigo-600 text-white" : "bg-white"}`}>{r.question.text.split(" — ").slice(1).join(" — ")}</button>)}<button type="button" onClick={() => onChange(group.map((a) => ({ id: a.question.id, answer: "unknown" })))} className="min-h-11 rounded-lg border px-3 text-sm">모름</button></div>
      </li>;
      if (attr === "age" || attr === "incomePct") return <li key={`${attr}:${group.map((a) => a.answer).join()}`} className="rounded-xl bg-white p-4"><NumericControl group={group} onChange={onChange} /></li>;
      if (LABELS[attr]) {
        const multi = ["interest", "field", "need"].includes(attr);
        const choices = [...new Set(group.flatMap((a) => Array.isArray(a.question.value) ? a.question.value : [a.question.value]).map(String))];
        const selected = group.filter((a) => a.answer === "yes").flatMap((a) => Array.isArray(a.question.value) ? a.question.value : [a.question.value]).map(String);
        const choose = (value: string) => onChange(group.map(({ question: q }) => ({ id: q.id, answer: (Array.isArray(q.value) ? q.value.map(String) : [String(q.value)]).includes(value) ? (multi && selected.includes(value) ? "no" : "yes") : multi ? (group.find((a) => a.question.id === q.id)!.answer) : "no" })));
        return <li key={attr} className="rounded-xl bg-white p-4" role="group" aria-label={LABELS[attr]}><p className="mb-2 font-semibold">{LABELS[attr]}</p>
          {multi ? <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">{choices.map((value) => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => choose(value)} className={`min-h-11 rounded-lg border px-3 text-sm ${selected.includes(value) ? "bg-indigo-600 text-white" : "bg-white"}`}>{VALUES[value] ?? value}</button>)}</div> :
            <select aria-label={LABELS[attr]} value={selected[0] ?? ""} onChange={(e) => e.target.value ? choose(e.target.value) : onChange(group.map((a) => ({ id: a.question.id, answer: "unknown" })))} className="min-h-11 w-full rounded-lg border p-2"><option value="">모름</option>{choices.map((value) => <option key={value} value={value}>{VALUES[value] ?? value}</option>)}</select>}
        </li>;
      }
      const r = group[0];
      return <li key={r.question.id} className="rounded-xl bg-white p-4" role="group" aria-label={r.question.text}><p className="mb-2 text-sm">{r.question.text}</p><div className="flex gap-2">{(["yes", "no", "unknown"] as const).map((answer, i) => <button key={answer} type="button" aria-pressed={r.answer === answer} onClick={() => onChange([{ id: r.question.id, answer }])} className={`min-h-11 flex-1 rounded-lg border ${r.answer === answer ? "bg-indigo-600 text-white" : "bg-white"}`}>{["예", "아니오", "모름"][i]}</button>)}</div></li>;
    })}
  </PaginatedList>;
}
