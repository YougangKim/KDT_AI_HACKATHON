"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Match } from "@/lib/types";
import { buildWatch, daysLeft, saveWatch } from "@/lib/alerts";
import { registerSW, requestPermission, checkAlerts, syncWatch } from "@/lib/alerts/client";
import { MatchCard } from "@/components/result/MatchCard";
import { readLastResult, type LastResult } from "@/components/result/lastResult";

function sortMatches(ms: Match[]): Match[] {
  const rank = (m: Match) => {
    const d = daysLeft(m.opportunity.applyEnd);
    return d === null ? 9999 : d < 0 ? 99999 : d;
  };
  return [...ms].sort(
    (a, b) => Number(a.status !== "eligible") - Number(b.status !== "eligible") || rank(a) - rank(b),
  );
}

const FIRST = 3; // 끝나자마자 먼저 보여 줄 공고 수

export default function ResultPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);
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
    setNote(p === "granted" ? "저장했어요. 매일 다시 찾아보고 새 공고·마감 임박을 알려 드려요." : "저장했어요. 알림이 꺼져 있어 앱을 열 때 🔔로 알려 드려요.");
  }

  async function onCheck() {
    const items = await checkAlerts();
    setNote(items.length ? "새 알림을 확인했습니다. 알림함에서 확인하세요." : "이번 조회에서 새로 알릴 공고가 없습니다.");
  }

  if (result === undefined) return null;

  if (!result || result.matches.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🤔
        </p>
        <p className="text-slate-600">{result ? "지금 조건에 맞는 공고가 없어요." : "아직 결과가 없어요."}</p>
        {result?.pool?.length ? (
          <Link href="/result/analysis" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            📊 왜 없을까? 분석 보기
          </Link>
        ) : null}
        <Link href="/" className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white">
          {result ? "다시 해 보기" : "시작하기"}
        </Link>
      </main>
    );
  }

  const sorted = sortMatches(result.matches);
  const shown = showAll ? sorted : sorted.slice(0, FIRST);
  const eligible = result.matches.filter((m) => m.status === "eligible").length;
  const rest = sorted.length - shown.length;

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500">
          ← 처음으로
        </Link>
        {result.pool?.length ? (
          <Link href="/result/analysis" className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
            📊 분석 보기
          </Link>
        ) : null}
      </header>

      <div>
        <h1 className="text-2xl font-bold">🔮 딱 맞는 공고예요</h1>
        <p className="text-sm text-slate-500">
          전체 {result.matches.length}개 · 바로 신청 {eligible}개
        </p>
      </div>

      <div className="space-y-3">
        {shown.map((m) => (
          <MatchCard key={m.opportunity.id} match={m} />
        ))}
      </div>

      {!showAll && rest > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowAll(true)} className="rounded-2xl border border-slate-300 bg-white py-3 text-sm font-semibold">
            더보기 +{rest}
          </button>
          <Link href="/play?continue=1" className="rounded-2xl bg-indigo-50 py-3 text-center text-sm font-semibold text-indigo-700">
            🎯 질문 더 해서 좁히기
          </Link>
        </div>
      )}

      <div className="sticky bottom-0 z-10 space-y-1 bg-slate-50/95 backdrop-blur py-3">
        {!saved ? (
          <>
            <button onClick={onSave} className="w-full rounded-2xl bg-indigo-600 py-3 font-semibold text-white shadow active:scale-95">
              🔔 이 조건으로 알림 받기
            </button>
            <p className="text-center text-[11px] text-slate-400">예·아니오 답변만 저장 · 알림함에서 삭제 가능</p>
          </>
        ) : (
          <button onClick={onCheck} className="w-full rounded-2xl border-2 border-indigo-600 bg-white py-3 font-semibold text-indigo-700 active:scale-95">
            새 공고 확인
          </button>
        )}
        {note && <p className="text-center text-xs text-slate-600">{note}</p>}
      </div>
    </main>
  );
}
