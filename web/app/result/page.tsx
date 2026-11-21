"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnswerRecord, Match, Opportunity } from "@/lib/types";
import { getMatches } from "@/lib/engine";
import { analyzeFunnel, summarizeConditions } from "@/lib/insight/funnel";
import { FunnelPanel } from "@/components/result/FunnelPanel";
import { buildWatch, daysLeft, saveWatch } from "@/lib/alerts";
import { registerSW, requestPermission, runDemo, syncWatch } from "@/lib/alerts/client";
import { MatchCard } from "@/components/result/MatchCard";
import { sampleResult } from "@/components/result/sampleResult";

type LastResult = { answers: AnswerRecord[]; matches: Match[]; pool?: Opportunity[] };

function readLastResult(): LastResult | null {
  if (new URLSearchParams(location.search).get("demo") === "1") return sampleResult();
  try {
    const raw = sessionStorage.getItem("lastResult");
    if (!raw) return null;
    const r = JSON.parse(raw) as LastResult;
    return Array.isArray(r.matches) ? { answers: r.answers ?? [], matches: r.matches, pool: r.pool } : null;
  } catch {
    return null;
  }
}

function sortMatches(ms: Match[]): Match[] {
  const rank = (m: Match) => {
    const d = daysLeft(m.opportunity.applyEnd);
    return d === null ? 9999 : d < 0 ? 99999 : d;
  };
  return [...ms].sort(
    (a, b) => Number(a.status !== "eligible") - Number(b.status !== "eligible") || rank(a) - rank(b),
  );
}

export default function ResultPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setResult(readLastResult());
  }, []);

  async function onSave() {
    if (!result) return;
    saveWatch(buildWatch(result.answers, result.matches));
    setSaved(true);
    await registerSW();
    const p = await requestPermission();
    await syncWatch(); // 서버에 조건 저장 → 앱을 닫아도 매일 반복 조사
    setNote(
      p === "granted"
        ? "알림을 저장했어요. 매일 이 조건으로 다시 조회해 처음 보는 공고를 알려 드려요. 마감 3일 전 공고는 앱을 열 때 🔔로 알려 드려요."
        : "알림을 저장했어요. 브라우저 알림이 꺼져 있어 앱을 열 때 🔔에 표시해 드려요.",
    );
  }

  async function onDemo() {
    const items = await runDemo();
    setNote(items.length ? "데모 알림을 보냈어요. 🔔를 눌러 확인해 보세요." : "먼저 알림을 저장해 주세요.");
  }

  const [hard, setHard] = useState<string[]>([]);
  useEffect(() => {
    try {
      setHard(JSON.parse(localStorage.getItem("hardConditions") ?? "[]"));
    } catch {}
  }, []);
  const funnel = useMemo(
    () => (result?.pool?.length ? analyzeFunnel(result.pool, result.answers, hard) : null),
    [result, hard],
  );
  const summary = useMemo(() => (result ? summarizeConditions(result.answers) : ""), [result]);
  const sampleSources = useMemo(
    () => [...new Set((result?.pool ?? []).filter((o) => o.isSample).map((o) => o.source))],
    [result],
  );

  function onRelax(questionId: string) {
    if (!result?.pool) return;
    const answers = result.answers.map((a) => (a.question.id === questionId ? { ...a, answer: "unknown" as const } : a));
    const next = { answers, matches: getMatches({ pool: result.pool, answers }), pool: result.pool };
    setResult(next);
    setSaved(false);
    try {
      sessionStorage.setItem("lastResult", JSON.stringify(next));
    } catch {}
    setNote("조건을 풀었어요. 마음에 들면 이 조건으로 알림을 저장하세요.");
  }

  function onKeep(questionId: string) {
    const next = [...new Set([...hard, questionId])];
    setHard(next);
    try {
      localStorage.setItem("hardConditions", JSON.stringify(next));
    } catch {}
  }

  if (result === undefined) return null;

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <header>
        <Link href="/" className="text-sm text-slate-500">
          ← 처음으로
        </Link>
      </header>

      {!result || result.matches.length === 0 ? (
        <section className="space-y-4 py-16 text-center">
          <p className="text-5xl" aria-hidden>
            🤔
          </p>
          <p className="text-slate-600">{result ? "지금 조건에 맞는 공고를 찾지 못했어요." : "아직 게임 결과가 없어요."}</p>
          {funnel && (
            <div className="text-left">
              <FunnelPanel report={funnel} summary={summary} sampleSources={sampleSources} onRelax={onRelax} onKeep={onKeep} />
            </div>
          )}
          <Link href="/play" className="inline-block rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white">
            {result ? "다시 해 보기" : "게임 시작하기"}
          </Link>
        </section>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold">🔮 찾았어요! {result.matches.length}개</h1>
            <p className="text-sm text-slate-500">
              바로 신청 {result.matches.filter((m) => m.status === "eligible").length}개 · 확인 필요{" "}
              {result.matches.filter((m) => m.status === "needs_check").length}개
            </p>
          </div>

          {funnel && <FunnelPanel report={funnel} summary={summary} sampleSources={sampleSources} onRelax={onRelax} onKeep={onKeep} />}

          <div className="sticky top-0 z-10 space-y-2 bg-[var(--background)] py-2">
            {!saved ? (
              <button
                onClick={onSave}
                className="w-full rounded-2xl bg-indigo-600 py-3 font-semibold text-white shadow active:scale-95"
              >
                🔔 이 조건으로 알림 받기
              </button>
            ) : null}
            {!saved ? (
              <p className="text-center text-[11px] text-slate-400">
                저장하면 예·아니오 답변만 서버에 보관돼요(이름·연락처 없음). 알림함에서 언제든 지울 수 있어요.
              </p>
            ) : (
              <button
                onClick={onDemo}
                className="w-full rounded-2xl border-2 border-indigo-600 bg-white py-3 font-semibold text-indigo-700 active:scale-95"
              >
                ✨ &quot;새 공고 도착&quot; 알림 데모
              </button>
            )}
            {note && <p className="text-center text-xs text-slate-600">{note}</p>}
          </div>

          <div className="space-y-3">
            {sortMatches(result.matches).map((m) => (
              <MatchCard key={m.opportunity.id} match={m} />
            ))}
          </div>

          <p className="pb-4 text-center text-xs text-slate-400">
            결과는 참고용이에요. 최종 자격은 공고 원문에서 확인하세요.
          </p>
        </>
      )}
    </main>
  );
}
