"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readLastResult } from "@/components/result/lastResult";
import { planText, ruleBasedPlan, type PrepPlan } from "@/lib/prep";
import { ddayLabel } from "@/lib/alerts/core";
import { DOMAIN_META } from "@/components/result/domain";
import { opportunityDistance } from "@/lib/geo/distance";
import type { Match } from "@/lib/types";

const TAG_STYLE = { posting: "bg-indigo-50 text-indigo-700", usual: "bg-slate-100 text-slate-600", mine: "bg-teal-50 text-teal-700" } as const;
const BANNER = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  check: "border-amber-200 bg-amber-50/60 text-amber-950",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  block: "border-red-300 bg-red-50 text-red-950",
} as const;
const ICON = { ok: "✅", check: "☑", warn: "⚠", block: "⛔" } as const;

/** 신청 준비(정보 제공): 대상 판정 → 조건 비교 → 한눈에 → 준비물 → 순서 (설계 docs/설계/신청준비_페이지_설계.md) */
export default function PreparePage() {
  const [match, setMatch] = useState<Match | null | undefined>(undefined);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    const r = readLastResult();
    const m = r?.matches.find((x) => x.opportunity.id === id) ?? null;
    setMatch(m);
    if (!m || !r) return;
    const base = ruleBasedPlan(m, r.answers);
    setPlan(base);
    try { setChecked(JSON.parse(localStorage.getItem(`prep:${m.opportunity.id}`) ?? "{}")); } catch {}
    const km = r.location ? opportunityDistance(r.location, m.opportunity) : null;
    if (km !== null) setDistance(`${Math.round(km)}km`);
  }, []);

  if (match === undefined) return <p className="py-16 text-center text-slate-500">불러오는 중…</p>;
  if (!match || !plan) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-600">준비할 공고를 찾지 못했습니다. 결과 화면에서 다시 선택해 주세요.</p>
        <Link href="/result" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">결과로 돌아가기</Link>
      </main>
    );
  }
  const o = match.opportunity;
  const t = plan.target;
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const toggle = (name: string) => {
    const next = { ...checked, [name]: !checked[name] };
    setChecked(next);
    try { localStorage.setItem(`prep:${o.id}`, JSON.stringify(next)); } catch {}
  };
  const done = plan.docs.filter((d) => checked[d.name]).length;
  const dday = o.applyEnd ? ddayLabel(o.applyEnd) : null;
  const g = plan.glance;
  const glanceRows: [string, string | undefined, string?][] = [["내용", g.what, g.whatNote], ["날짜", g.when], ["장소", g.where], ["신청방법", g.how]];

  return (
    <main className="space-y-3 py-6 pb-28 print:py-0 print:pb-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/result" className="text-sm text-slate-600">← 결과로</Link>
        <div className="flex gap-2">
          <button onClick={() => copy("all", planText(plan, o))} className="rounded-lg border bg-white px-3 py-1.5 text-sm">{copied === "all" ? "복사됨" : "전체 복사"}</button>
          <button onClick={() => window.print()} className="rounded-lg border bg-white px-3 py-1.5 text-sm">인쇄·PDF</button>
        </div>
      </div>

      <header className="app-card space-y-1 p-4">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{DOMAIN_META[o.domain].label}</span>
          {plan.kindLabel !== DOMAIN_META[o.domain].label && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">{plan.kindLabel}</span>}
        </div>
        <h1 className="text-lg font-bold leading-snug break-keep">{plan.title}</h1>
        <p className="text-sm text-slate-600">{[o.org, plan.series, o.place, distance && `내 위치에서 ${distance}`].filter(Boolean).join(" · ")}</p>
        <p className="text-sm font-bold">
          {o.applyEnd ? <>마감 {o.applyEnd.slice(0, 10)} <span className="text-red-600">({dday === "D-day" ? "오늘 마감" : dday})</span></> : "상시 접수"}
        </p>
      </header>


      <section className="app-card p-4" aria-label="내 조건과 비교">
        <h2 className="mb-2 font-bold">내 조건과 비교</h2>
        {plan.rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-slate-500"><th className="pb-1 font-semibold">공고 조건</th><th className="pb-1 font-semibold">내 답</th><th /></tr></thead>
            <tbody>
              {plan.rows.map((r) => (
                <tr key={r.cond} className="border-t align-top">
                  <td className="py-1.5 pr-2">{r.cond}{r.note && <span className="block text-[11px] text-slate-500">{r.note}</span>}</td>
                  <td className="py-1.5 pr-2">{r.mine}</td>
                  <td className={`whitespace-nowrap py-1.5 font-bold ${r.verdict === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{r.verdict === "ok" ? "✓ 맞음" : "⚠ 확인"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-600">공고에 나이·지역·소득 같은 자격 조건이 적혀 있지 않습니다. 원문의 &apos;참여 대상&apos;을 확인하세요.</p>
        )}
        {plan.prefs.length > 0 && (
          <details className="mt-2 border-t border-dashed pt-1.5 text-xs text-slate-500">
            <summary className="cursor-pointer">찾던 것과 맞는 점 {plan.prefs.length}개</summary>
            <p className="mt-1">{plan.prefs.join(" · ")}</p>
          </details>
        )}
      </section>

      <section className="app-card p-4" aria-label="이 공고 한눈에">
        <h2 className="mb-2 font-bold">이 공고 한눈에</h2>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
          {glanceRows.map(([k, v, note]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-slate-500">{k}</dt>
              <dd className={v ? "" : "text-slate-400"}>{v ?? "원문 확인"}{v && note && <span className="text-[11px] text-slate-500"> · {note}</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="app-card p-4" aria-label="준비 체크리스트">
        <h2 className="mb-1 flex items-center justify-between font-bold">준비 체크리스트 <span className="text-xs font-semibold text-slate-500">{done}/{plan.docs.length}</span></h2>
        <ul className="space-y-1 text-sm">
          {plan.docs.map((d) => (
            <li key={d.name}>
              <label className="flex items-start gap-2 py-0.5">
                <input type="checkbox" className="mt-1" checked={!!checked[d.name]} onChange={() => toggle(d.name)} />
                <span className="flex-1">{d.name}</span>
                <span className={`whitespace-nowrap rounded-md px-1.5 text-[10.5px] font-bold ${TAG_STYLE[d.src]}`}>{d.tag}</span>
              </label>
            </li>
          ))}
        </ul>
        {!plan.docsFromPosting && <p className="mt-1 text-[11.5px] text-slate-500">공고에 제출 서류가 적혀 있지 않아 이런 공고에 보통 필요한 목록입니다.</p>}
      </section>

      <section className="app-card p-4" aria-label="신청 순서">
        <h2 className="mb-2 font-bold">신청 순서</h2>
        <ol className="ml-1.5 border-l-2 border-slate-200">
          {plan.steps.map((s) => (
            <li key={s.when + s.text} className="relative pb-2 pl-4 text-sm before:absolute before:-left-[7px] before:top-1 before:h-3 before:w-3 before:rounded-full before:border-2 before:border-indigo-600 before:bg-white">
              <span className="block text-[11.5px] font-bold text-indigo-700">{s.when}</span>{s.text}
            </li>
          ))}
        </ol>
      </section>


      <section role="status" className={`rounded-2xl border p-4 text-sm ${BANNER[t.level]}`}>
        <p className="font-bold">{ICON[t.level]} {t.head}</p>
        <p className="mt-0.5">{t.why}</p>
        {(t.level === "warn" || t.level === "block") && <Link href="/result" className="mt-1 inline-block font-bold underline print:hidden">결과에서 다른 청년 대상 공고 보기 →</Link>}
      </section>

      <a href={o.apply?.url || o.url} target="_blank" rel="noopener noreferrer"
        className={`fixed inset-x-4 bottom-4 z-10 mx-auto block max-w-md min-h-12 content-center rounded-2xl py-3 text-center font-bold shadow-lg print:hidden ${t.level === "ok" || t.level === "check" ? "bg-indigo-600 text-white" : "border-2 border-indigo-600 bg-white text-indigo-700"}`}>
        {t.expired ? "원문 보기 ↗" : t.level === "ok" ? "준비 끝, 원문에서 신청하기 ↗" : t.level === "check" ? "조건 확인하고 원문에서 신청하기 ↗" : "원문에서 대상 확인하기 ↗"}
      </a>
    </main>
  );
}
