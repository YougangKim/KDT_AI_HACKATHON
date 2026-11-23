"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readLastResult } from "@/components/result/lastResult";
import { ruleBasedPlan, type PrepPlan } from "@/lib/prep";
import { ddayLabel } from "@/lib/alerts/core";
import { DOMAIN_META } from "@/components/result/domain";
import { opportunityDistance } from "@/lib/geo/distance";
import { nearestRegion } from "@/lib/geo/regions";
import type { Match } from "@/lib/types";

/** 신청 준비: 공고를 바로 열기 전에 내 답과 공고를 맞춰 보고 준비물·초안을 정리한다 */
export default function PreparePage() {
  const [match, setMatch] = useState<Match | null | undefined>(undefined);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [aiState, setAiState] = useState<"loading" | "done" | "off">("loading");
  const [distance, setDistance] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    const r = readLastResult();
    const m = r?.matches.find((x) => x.opportunity.id === id) ?? null;
    setMatch(m);
    if (!m || !r) return;
    const base = ruleBasedPlan(m, r.answers);
    setPlan(base);
    const km = r.location ? opportunityDistance(r.location, m.opportunity) : null;
    if (km !== null) setDistance(`${Math.round(km)}km`);
    const region = r.location ? nearestRegion(r.location.lat, r.location.lng) : "";
    fetch("/api/prep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opportunity: m.opportunity,
        answers: r.answers.map((a) => ({ text: a.question.text, answer: a.answer })),
        location: region,
      }),
    })
      .then((res) => res.json())
      .then((j: { ai?: boolean; tips?: string[]; drafts?: PrepPlan["drafts"] }) => {
        if (j.ai) {
          setTips(j.tips ?? []);
          if (j.drafts?.length) setPlan((p) => (p ? { ...p, drafts: j.drafts!, ai: true } : p));
          setAiState("done");
        } else setAiState("off");
      })
      .catch(() => setAiState("off"));
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
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const allText = [
    `[${o.title}] ${o.org}`,
    `마감: ${o.applyEnd?.slice(0, 10) ?? "상시"}`,
    "",
    "■ 준비 서류", ...plan.docs.map((d) => `- ${d}`),
    "", "■ 신청 순서", ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
    ...plan.drafts.flatMap((d) => ["", `■ ${d.title}`, d.body]),
    "", `원문: ${o.apply?.url || o.url}`,
  ].join("\n");

  return (
    <main className="space-y-4 py-6 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/result" className="text-sm text-slate-600">← 결과로</Link>
        <div className="flex gap-2">
          <button onClick={() => copy("all", allText)} className="rounded-lg border px-3 py-1.5 text-sm">{copied === "all" ? "복사됨" : "전체 복사"}</button>
          <button onClick={() => window.print()} className="rounded-lg border px-3 py-1.5 text-sm">인쇄·PDF</button>
        </div>
      </div>

      <header className="app-card space-y-1 p-4">
        <p className="text-xs font-semibold text-indigo-700">{DOMAIN_META[o.domain].label} · 신청 준비</p>
        <h1 className="text-lg font-bold break-keep">{o.title}</h1>
        <p className="text-sm text-slate-600">{o.org}{o.place ? ` · ${o.place}` : ""}{distance ? ` · 내 위치에서 ${distance}` : ""}</p>
        <p className="text-sm font-semibold">{o.applyEnd ? `마감 ${o.applyEnd.slice(0, 10)} (${ddayLabel(o.applyEnd)})` : "상시 접수"}</p>
      </header>

      <section className="app-card space-y-2 p-4" aria-label="내 조건과 비교">
        <h2 className="font-bold">내 조건과 비교</h2>
        {plan.fit.length > 0 && <ul className="space-y-1 text-sm">{plan.fit.map((f) => <li key={f}>✓ {f}</li>)}</ul>}
        {plan.check.length > 0 ? <ul className="space-y-1 text-sm text-amber-800">{plan.check.map((c) => <li key={c}>! 확인 필요: {c}</li>)}</ul> : <p className="text-sm text-slate-600">추가로 확인할 자격 조건이 없습니다.</p>}
      </section>

      <section className="app-card space-y-2 p-4" aria-label="준비 체크리스트">
        <h2 className="font-bold">준비 체크리스트</h2>
        <ul className="space-y-1 text-sm">{plan.docs.map((d) => <li key={d}><label className="flex gap-2"><input type="checkbox" />{d}</label></li>)}</ul>
        <h3 className="pt-2 text-sm font-semibold">신청 순서</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{plan.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {tips.length > 0 && <><h3 className="pt-2 text-sm font-semibold">준비 요령(AI)</h3><ul className="space-y-1 text-sm">{tips.map((t) => <li key={t}>· {t}</li>)}</ul></>}
      </section>

      <section className="app-card space-y-3 p-4" aria-label="작성 초안">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">작성 초안</h2>
          <span className="text-xs text-slate-500">{aiState === "loading" ? "AI가 초안을 다듬는 중…" : plan.ai ? "AI 작성 · 그대로 내지 말고 고쳐 쓰세요" : "기본 초안 · [ ] 부분을 채워 주세요"}</span>
        </div>
        {plan.drafts.map((d) => (
          <div key={d.title} className="space-y-1 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{d.title}</h3>
              <button onClick={() => copy(d.title, d.body)} className="text-xs text-indigo-700 underline print:hidden">{copied === d.title ? "복사됨" : "복사"}</button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.body}</p>
          </div>
        ))}
        <p className="text-[11px] text-slate-500">공고에 없는 내용은 지어내지 않도록 했지만, 제출 전 원문과 반드시 대조해 주세요.</p>
      </section>

      <a href={o.apply?.url || o.url} target="_blank" rel="noopener noreferrer" className="block min-h-12 content-center rounded-2xl bg-indigo-600 py-3 text-center font-bold text-white print:hidden">
        준비 끝, 원문에서 신청하기 ↗
      </a>
    </main>
  );
}
