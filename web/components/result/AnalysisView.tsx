"use client";

import Link from "next/link";
import { useState } from "react";
import type { FilterStep, FunnelReport } from "@/lib/insight/types";
import type { AnswerRecord, Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";

const EMP: Record<string, string> = { student: "학생", jobseeker: "구직", employed: "재직", parttime: "알바" };
const DOMAIN_SHORT: Record<string, string> = { housing: "주택", benefit: "지원금", job: "채용", parttime: "알바", training: "국비", exam: "자격증" };

/** 답변 하나를 짧은 칩 문구로: "만 34세↓", "부산 ✕", "무주택" */
export function chipOf(a: AnswerRecord): string | null {
  if (a.answer === "unknown") return null;
  const { attr, op, value } = a.question;
  const yes = a.answer === "yes";
  const v = Array.isArray(value) ? value[0] : value;
  switch (attr) {
    case "age":
      return op === "lte" ? (yes ? `${v}세↓` : `${Number(v) + 1}세↑`) : yes ? `${v}세↑` : `${Number(v) - 1}세↓`;
    case "region":
      return yes ? String(v) : `${v} ✕`;
    case "homeless":
      return (v === true) === yes ? "무주택" : "유주택";
    case "livingAlone":
      return (v === true) === yes ? "1인 가구" : "가족 동거";
    case "incomePct":
      return yes ? `소득 ${v}%↓` : `소득 ${v}%↑`;
    case "employment":
      return yes ? EMP[String(v)] ?? String(v) : `${EMP[String(v)] ?? v} ✕`;
    case "subscription":
      return (v === true) === yes ? "청약통장" : "청약통장 ✕";
    case "married":
      return (v === true) === yes ? "신혼부부" : "신혼 ✕";
    case "welfare":
      return (v === true) === yes ? "수급·차상위" : "수급 ✕";
    case "experienced":
      return (v === true) === yes ? "경력 있음" : "신입";
    case "education":
      return yes ? `학력 ${v}단계↑` : `학력 ${Number(v) - 1}단계↓`;
    case "field":
    case "need":
      return yes ? String(v) : `${v} ✕`;
    case "housingKind":
      return (v === "sale") === yes ? "분양" : "임대";
    case "interest":
      return yes ? DOMAIN_SHORT[String(v)] ?? String(v) : `${DOMAIN_SHORT[String(v)] ?? v} ✕`;
  }
  return null;
}


export function AnalysisView({
  report,
  sampleCount,
  onRelax,
}: {
  report: FunnelReport;
  answers: AnswerRecord[];
  sampleCount: number;
  onRelax: (questionId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pct = Math.round(report.passRate * 100);
  const domains = (Object.entries(report.byDomain) as [Domain, { total: number; passed: number }][]).filter(([, v]) => v.total > 0);
  const maxCut = Math.max(1, ...report.steps.map((step) => step.removedCount));

  return (
    <div className="space-y-3">
      <section className="app-card space-y-3 p-4">
        <p className="text-base font-bold break-keep">
          전체 {report.total.toLocaleString()}건 중{" "}
          <strong className="text-indigo-700">{report.passed.toLocaleString()}건</strong>이 남았어요
          <span className="ml-1 text-sm font-semibold text-slate-500">({pct}%)</span>
        </p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          {domains.map(([domain, value]) => (
            <div key={domain}>
              <div className="flex items-center justify-between text-[11px]">
                <span>{DOMAIN_SHORT[domain]}</span>
                <span className="font-bold">{value.passed}</span>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${value.total ? (value.passed / value.total) * 100 : 0}%`,
                    backgroundColor: DOMAIN_META[domain].color,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="funnel-title">
        <h2 id="funnel-title" className="mb-2 text-sm font-bold">질문별로 걸러진 공고</h2>
        <ol className="space-y-2">
          {report.steps.map((step, index) => {
            const open = expanded === step.questionId;
            const gain = Math.max(0, step.passedWithout - report.passed);
            return (
              <li key={step.questionId} className="app-card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`question-detail-${index}`}
                  onClick={() => setExpanded(open ? null : step.questionId)}
                  className="w-full p-3 text-left"
                >
                  <span className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-slate-500">{step.question}</span>
                      <span className="block truncate text-sm font-bold">{step.answerLabel}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-rose-600">
                      {step.removedCount.toLocaleString()}건 제외
                    </span>
                  </span>
                  <span className="mt-2 flex items-center gap-2 pl-7">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-rose-400"
                        style={{ width: `${(step.removedCount / maxCut) * 100}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-slate-500">{step.reason}</span>
                  </span>
                </button>
                {open && (
                  <div id={`question-detail-${index}`} className="space-y-3 border-t border-slate-100 px-3 py-3">
                    {step.examples.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-700">
                        {step.examples.map((title) => <li key={title}>• {title}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">이 단계에서 제외된 공고가 없어요.</p>
                    )}
                    {gain > 0 && (
                      <button
                        type="button"
                        onClick={() => onRelax(step.questionId)}
                        className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
                        aria-label={`${step.question} 답을 풀면 ${gain}건 늘어나요. 적용`}
                      >
                        이 답 풀어 보기 · +{gain.toLocaleString()}건
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {report.pendingQuestions.length > 0 && (
        <section className="app-card space-y-2 border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-950">
            확인이 더 필요한 공고 {report.pendingCount.toLocaleString()}건
          </h2>
          <p className="text-xs text-amber-900">잘 모르겠다고 답한 질문이 있어 원문 확인이 필요해요.</p>
          <ul className="space-y-1 text-xs text-amber-950">
            {report.pendingQuestions.map((item) => <li key={item.attr}>• {item.question}</li>)}
          </ul>
          <Link href="/play?continue=1" className="inline-block text-xs font-bold text-indigo-700 underline">
            다시 답하기
          </Link>
        </section>
      )}

      {report.relaxOptions.length > 0 && (
        <section className="app-card space-y-2 p-4">
          <h2 className="text-sm font-bold">결과를 더 보고 싶다면</h2>
          {report.relaxOptions.map((option) => (
            <button
              key={option.step.questionId}
              type="button"
              onClick={() => onRelax(option.step.questionId)}
              className="flex w-full justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm"
            >
              <span>{option.step.answerLabel} 답을 풀면</span>
              <strong className="text-emerald-700">+{option.gain.toLocaleString()}건</strong>
            </button>
          ))}
        </section>
      )}

      {sampleCount > 0 && (
        <p className="text-center text-[11px] text-amber-700">
          예시 데이터 출처 {sampleCount}곳 포함
        </p>
      )}
    </div>
  );
}
