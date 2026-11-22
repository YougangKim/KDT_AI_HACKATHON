"use client";

import type { FilterStep, FunnelReport } from "@/lib/insight/types";
import type { AnswerRecord, Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";
import { Icon } from "@/components/brand/Icons";

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

const stepChip = (s: FilterStep) => chipOf(s.answer) ?? s.label;

export function AnalysisView({
  report,
  answers,
  sampleCount,
  onRelax,
  onKeep,
  onPickStep,
}: {
  report: FunnelReport;
  answers: AnswerRecord[];
  sampleCount: number;
  onRelax: (questionId: string) => void;
  onKeep: (questionId: string) => void;
  onPickStep?: (questionId: string) => void; // 조건별 탈락 막대를 누르면 그 조건 때문에 빠진 공고 목록으로
}) {
  const pct = Math.round(report.passRate * 100);
  // 같은 수치 조건(소득 250%↓, 200%↓)은 가장 좁은 마지막 답만 칩으로
  const lastNumeric = new Map<string, AnswerRecord>();
  for (const a of answers) if (a.answer !== "unknown" && typeof a.question.value === "number") lastNumeric.set(`${a.question.attr}:${a.question.op}:${a.answer}`, a);
  const chips = [...new Set(answers
    .filter((a) => typeof a.question.value !== "number" || lastNumeric.get(`${a.question.attr}:${a.question.op}:${a.answer}`) === a)
    .map(chipOf)
    .filter((c): c is string => !!c))];
  const domains = (Object.entries(report.byDomain) as [Domain, { total: number; passed: number }][]).filter(([, v]) => v.total > 0);
  const cuts = report.steps.filter((s) => s.aloneRemoved > 0).slice(0, 4);
  const maxCut = Math.max(1, ...cuts.map((s) => s.aloneRemoved));
  const b = report.bottleneck;

  return (
    <div className="space-y-4">
      {/* 1. 통과율 링 */}
      <section className="flex items-center gap-5 rounded-3xl bg-white p-5 shadow-sm">
        <div
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#4f46e5 ${pct * 3.6}deg, #e2e8f0 0)` }}
          aria-label={`통과율 ${pct}%`}
        >
          <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white">
            <span className="text-2xl font-black">{pct}%</span>
          </div>
        </div>
        <div>
          <p className="text-3xl font-black">
            {report.passed}
            <span className="text-base font-semibold text-slate-400"> / {report.total}</span>
          </p>
          <p className="text-sm text-slate-500">조건 통과</p>
          {report.scarce && <p className="mt-1 text-xs font-semibold text-rose-600">너무 적어요</p>}
        </div>
      </section>

      {/* 2. 내 조건 칩 */}
      {chips.length > 0 && (
        <section className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800">
              {c}
            </span>
          ))}
        </section>
      )}

      {/* 3. 병목 */}
      {b && (
        <section className="rounded-3xl bg-amber-50 p-5">
          <p className="text-xs font-semibold text-amber-700">가장 많이 막은 조건</p>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-black">{stepChip(b.step)}</span>
            <span className="text-3xl font-black text-emerald-600">+{b.gain}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => onRelax(b.step.questionId)} className="rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white">
              풀기
            </button>
            <button onClick={() => onKeep(b.step.questionId)} className="rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold">
              <Icon name="lock" className="mr-1 inline h-4 w-4 align-[-3px]" />유지
            </button>
          </div>
        </section>
      )}

      {/* 4. 조건별 컷 */}
      {cuts.length > 0 && (
        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">조건별 탈락 <span className="font-normal text-slate-400">· 누르면 빠진 공고 보기</span></p>
          {cuts.map((s) => (
            <button
              type="button"
              key={s.questionId}
              onClick={() => onPickStep?.(s.questionId)}
              aria-label={`${stepChip(s)} 때문에 빠진 공고 ${s.aloneRemoved}개 보기`}
              className="flex w-full items-center gap-2 text-left text-sm"
            >
              <span className="w-24 shrink-0 truncate font-medium">
                {s.hard && <Icon name="lock" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                {stepChip(s)}
              </span>
              <span className="h-2.5 flex-1 rounded-full bg-slate-100">
                <span
                  className={`block h-full rounded-full ${b?.step.questionId === s.questionId ? "bg-rose-500" : "bg-slate-400"}`}
                  style={{ width: `${(s.aloneRemoved / maxCut) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-bold text-rose-600">−{s.aloneRemoved}</span>
            </button>
          ))}
        </section>
      )}

      {/* 5. 분야별 */}
      {domains.length > 0 && (
        <section className="grid grid-cols-3 gap-2">
          {domains.map(([d, v]) => (
            <div key={d} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <span className="mx-auto grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: DOMAIN_META[d].color }} aria-hidden>
                <Icon name={DOMAIN_META[d].icon} className="h-5 w-5" />
              </span>
              <p className="text-lg font-black">
                {v.passed}
                <span className="text-xs font-semibold text-slate-400">/{v.total}</span>
              </p>
              <p className="text-[11px] text-slate-500">{DOMAIN_SHORT[d] ?? d}</p>
            </div>
          ))}
        </section>
      )}

      {sampleCount > 0 && <p className="flex items-center justify-center gap-1 text-center text-[11px] text-amber-700"><Icon name="warning" className="h-3.5 w-3.5" />예시 데이터 출처 {sampleCount}곳 포함</p>}
    </div>
  );
}
