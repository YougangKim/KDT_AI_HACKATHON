"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer } from "@/lib/types";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { rankQuestions } from "@/lib/engine";
import { RelaxSuggestions } from "@/components/result/RelaxSuggestions";
import { buildWatch, saveWatch } from "@/lib/alerts";
import { registerSW, requestPermission, checkAlerts, syncWatch } from "@/lib/alerts/client";
import { MatchCard } from "@/components/result/MatchCard";
import { readLastResult, relaxAnswer, setAnswer, type LastResult } from "@/components/result/lastResult";
import { ResultMap, type ResultMapHandle } from "@/components/result/ResultMap";
import { ConditionEditor } from "@/components/result/ConditionEditor";
import { myRegion, sortMatches } from "@/components/result/sort";
import { opportunityDistance } from "@/lib/geo/distance";

type AiSummary = { id: string; summary: string; how: string };

const FIRST = 3; // 끝나자마자 먼저 보여 줄 공고 수

export default function ResultPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [highlighted, setHighlighted] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const [summaries, setSummaries] = useState<Record<string, AiSummary>>({});
  const [summaryMs, setSummaryMs] = useState<Record<string, number>>({});

  const [hard, setHard] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const mapRef = useRef<ResultMapHandle>(null);

  useEffect(() => {
    setResult(readLastResult());
    try {
      setHard(JSON.parse(localStorage.getItem("hardConditions") ?? "[]"));
    } catch {}
  }, []);

  const requestSummaries = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const started = performance.now();
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await response.json() as { ai?: boolean; items?: AiSummary[] };
      const elapsed = performance.now() - started;
      if (body.ai && body.items?.length) {
        setSummaries((current) => Object.fromEntries([
          ...Object.entries(current),
          ...body.items!.map((item) => [item.id, item]),
        ]));
        setSummaryMs((current) => ({
          ...current,
          ...Object.fromEntries(body.items!.map((item) => [item.id, elapsed])),
        }));
      }
    } catch {}
  }, []);

  // 결과가 적으면 어떤 조건을 풀면 늘어나는지 바로 보여 준다
  const report = useMemo(() => (result?.pool?.length ? analyzeFunnel(result.pool, result.answers, hard) : null), [result, hard]);
  const relax = report?.scarce ? report.relaxOptions : [];
  // 더 물어볼 질문이 남아 있을 때만 "질문 더 해서 좁히기"를 연다(누르면 바로 "없어요"가 되는 버튼 방지)
  const canNarrow = useMemo(() => !!result?.pool?.length && rankQuestions({ pool: result.pool, answers: result.answers }, 1).length > 0, [result]);

  function onRelax(questionId: string) {
    if (!result) return;
    const next = relaxAnswer(result, questionId);
    const ok = (r: LastResult) => r.matches.filter((m) => m.status === "eligible").length;
    const gained = next.matches.length - result.matches.length;
    const okGain = ok(next) - ok(result);
    // 늘어난 것 중 바로 신청 가능한 것과 자격 확인이 필요한 것을 나눠 알려 준다(과장 방지)
    const detail =
      okGain >= 0
        ? `바로 신청 +${okGain} · 확인 필요 +${gained - okGain}`
        : `모두 확인 필요, 기존 바로 신청 ${-okGain}개도 확인 필요로 바뀜`;
    setNote(`조건을 풀어서 ${gained}개 늘었어요(${detail}).`);
    setResult(next);
  }

  function onEdit(questionId: string, a: Answer) {
    if (!result) return;
    const next = setAnswer(result, questionId, a);
    setNote(`조건을 바꿨어요. ${result.matches.length}개 → ${next.matches.length}개`);
    setResult(next);
    setSaved(false); // 바뀐 조건으로 다시 저장할 수 있게
  }

  async function onSave() {
    if (!result) return;
    saveWatch({
      ...buildWatch(result.answers, result.matches),
      location: result.location,
    });
    await registerSW();
    const p = await requestPermission();
    const r = await syncWatch(); // 서버에 조건 저장 → 앱을 닫아도 매일 반복 조사
    if (r.error || !r.saved) {
      // 버튼을 그대로 둬서 다시 누르면 재시도
      setNote(`이 기기에는 저장했지만 서버 저장에 실패했어요(${r.error ?? "알 수 없는 오류"}). 다시 눌러 재시도하세요.`);
      return;
    }
    setSaved(true);
    setNote(p === "granted" ? "저장했어요. 매일 다시 찾아보고 새 공고·마감 임박을 알려 드려요." : "저장했어요. 알림이 꺼져 있어 앱을 열 때 🔔로 알려 드려요.");
  }

  async function onCheck() {
    const items = await checkAlerts();
    setNote(items.length ? "새 알림을 확인했습니다. 알림함에서 확인하세요." : "이번 조회에서 새로 알릴 공고가 없습니다.");
  }

  const selectFromMap = useCallback((id: string) => {
    setShowAll(true);
    setHighlighted(id);
    requestAnimationFrame(() => {
      document.getElementById(`match-${encodeURIComponent(id)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setHighlighted(""), 2500);
  }, []);

  // 정렬·첫 요약 요청은 훅이라 조기 return보다 위에 둔다
  const sortedAll = useMemo(() => {
    if (!result) return [];
    return sortMatches(result.matches, myRegion(result.answers)).sort((a, b) => {
      if (!result.location) return 0;
      if (a.status !== b.status) return a.status === "eligible" ? -1 : 1;
      const da = opportunityDistance(result.location, a.opportunity);
      const db = opportunityDistance(result.location, b.opportunity);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [result]);
  const firstIds = sortedAll.slice(0, FIRST).map((match) => match.opportunity.id).join("|");
  useEffect(() => {
    void requestSummaries(firstIds ? firstIds.split("|") : []);
  }, [firstIds, requestSummaries]);

  if (result === undefined) return null;

  const editor = result?.answers.length ? (
    <section className="space-y-2">
      <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
        ✏️ 조건 고치기 ({result.answers.length}개) {editing ? "▲" : "▼"}
      </button>
      {editing && <ConditionEditor answers={result.answers} onChange={onEdit} />}
    </section>
  ) : null;

  const saveBar = result ? (
    <div className="sticky bottom-0 z-10 w-full space-y-1 bg-slate-50/95 backdrop-blur py-3">
      {!saved ? (
        <>
          <button onClick={onSave} className="w-full rounded-2xl bg-indigo-600 py-3 font-semibold text-white shadow active:scale-95">
            🔔 {result.matches.length ? "이 조건으로 알림 받기" : "이 조건으로 새 공고 오면 알림 받기"}
          </button>
          <p className="text-center text-[11px] text-slate-400">예·아니오 답변만 저장 · 알림함에서 삭제 가능</p>
        </>
      ) : (
        <button onClick={onCheck} className="w-full rounded-2xl border-2 border-indigo-600 bg-white py-3 font-semibold text-indigo-700 active:scale-95">
          새 공고 확인
        </button>
      )}
      {saved && <Link href="/settings" className="block text-center text-xs text-indigo-700 underline">
        알림 시간·위치 바꾸기
      </Link>}
      {note && <p className="text-center text-xs text-slate-600" role="status">{note}</p>}
    </div>
  ) : null;


  if (!result || result.matches.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🤔
        </p>
        <p className="text-slate-600">{result ? "지금 조건에 맞는 공고가 없어요." : "아직 결과가 없어요."}</p>
        {relax.length > 0 && (
          <div className="w-full text-left">
            <RelaxSuggestions options={relax} onRelax={onRelax} title="이 조건을 풀면 공고가 생겨요" />
          </div>
        )}
        {result?.pool?.length ? (
          <Link href="/result/analysis" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            📊 왜 없을까? 분석 보기
          </Link>
        ) : null}
        <div className="w-full text-left">{editor}</div>
        <Link href="/" className="rounded-2xl bg-slate-100 px-6 py-3 font-semibold text-slate-700">
          {result ? "처음부터 다시" : "시작하기"}
        </Link>
        {saveBar}
      </main>
    );
  }

  const sorted = sortedAll;

  function showMore() {
    setShowAll(true);
    void requestSummaries(sorted.slice(FIRST, FIRST + 5).map((match) => match.opportunity.id));
  }

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
          <span className="flex items-center gap-2">
            <Link href="/settings" className="text-sm text-indigo-700">⚙️ 설정</Link>
            <Link href="/result/analysis" className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              📊 분석 보기
            </Link>
          </span>
        ) : null}
      </header>

      <div>
        <h1 className="text-2xl font-bold">📰 딱 맞는 공고예요</h1>
        <p className="text-sm text-slate-500">
          전체 {result.matches.length}개 · 바로 신청 {eligible}개
        </p>
      </div>

      {result.radiusExcluded ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <span>반경 밖 {result.radiusExcluded}건을 제외했어요.</span>
          <Link href="/play" className="min-h-11 shrink-0 content-center rounded-xl bg-white px-3 font-semibold ring-1 ring-amber-200">
            반경 넓히기
          </Link>
        </div>
      ) : null}

      {result.matches.some((match) => match.opportunity.geo) ? (
        <ResultMap ref={mapRef} matches={sorted} location={result.location} onSelect={selectFromMap} />
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">
          위치를 설정하면 공고를 지도로 볼 수 있어요.
        </p>
      )}

      {relax.length > 0 && <RelaxSuggestions options={relax} onRelax={onRelax} title={`${result.matches.length}개뿐이에요. 이 조건을 풀면 더 보여요`} />}

      <div className="space-y-3">
        {shown.map((m) => (
          <MatchCard
            key={m.opportunity.id}
            match={m}
            location={result.location}
            highlighted={highlighted === m.opportunity.id}
            onShowMap={m.opportunity.geo?.precision !== "region" ? () => mapRef.current?.show(m.opportunity.id) : undefined}
            aiSummary={summaries[m.opportunity.id]}
            summaryMs={summaryMs[m.opportunity.id]}
          />
        ))}
      </div>

      <div className={`grid gap-2 ${!showAll && rest > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
        {!showAll && rest > 0 && (
          <button onClick={showMore} className="rounded-2xl border border-slate-300 bg-white py-3 text-sm font-semibold">
            더보기 +{rest}
          </button>
        )}
        {/* 더보기를 눌러도 사라지지 않게 항상 둔다. 더 물을 질문이 없으면 이유를 보여 준다 */}
        {canNarrow ? (
          <Link href="/play?continue=1" className="rounded-2xl bg-indigo-50 py-3 text-center text-sm font-semibold text-indigo-700">
            🎯 질문 더 해서 좁히기
          </Link>
        ) : (
          <p className="rounded-2xl bg-slate-100 py-3 text-center text-xs text-slate-500 break-keep">더 물어볼 질문이 없어요 · 아래 조건 고치기로 바꿔 보세요</p>
        )}
      </div>

      {editor}

      {saveBar}
    </main>
  );
}
