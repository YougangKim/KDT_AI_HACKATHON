"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer, Domain } from "@/lib/types";
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
import { DOMAIN_META } from "@/components/result/domain";
import { Icon } from "@/components/brand/Icons";

type AiSummary = { id: string; summary: string; how: string };
type ResultTab = "all" | Domain;

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
  const [tab, setTab] = useState<ResultTab>("all");
  const mapRef = useRef<ResultMapHandle>(null);

  useEffect(() => {
    setResult(readLastResult());
    try {
      setHard(JSON.parse(localStorage.getItem("hardConditions") ?? "[]"));
    } catch {}
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "all" || (requested && requested in DOMAIN_META)) setTab(requested as ResultTab);
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
    setNote(p === "granted" ? "저장했어요. 매일 다시 찾아보고 새 공고·마감 임박을 알려 드려요." : "저장했어요. 알림이 꺼져 있어 앱을 열 때 알림함에 표시해 드려요.");
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
  const domainCounts = useMemo(() => {
    const counts = new Map<Domain, number>();
    for (const match of result?.matches ?? []) {
      const domain = match.opportunity.domain;
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    return counts;
  }, [result]);
  const selectedMatches = useMemo(
    () => result?.matches.filter((match) => tab === "all" || match.opportunity.domain === tab) ?? [],
    [result, tab],
  );
  const sortedAll = useMemo(() => {
    if (!result) return [];
    return sortMatches(selectedMatches, myRegion(result.answers)).sort((a, b) => {
      if (!result.location) return 0;
      if (a.status !== b.status) return a.status === "eligible" ? -1 : 1;
      const da = opportunityDistance(result.location, a.opportunity);
      const db = opportunityDistance(result.location, b.opportunity);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [result, selectedMatches]);
  const firstIds = sortedAll.slice(0, FIRST).map((match) => match.opportunity.id).join("|");
  useEffect(() => {
    void requestSummaries(firstIds ? firstIds.split("|") : []);
  }, [firstIds, requestSummaries]);
  useEffect(() => {
    setShowAll(false);
    setHighlighted("");
  }, [tab]);

  function selectTab(next: ResultTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  if (result === undefined) return null;

  const editor = result?.answers.length ? (
    <section className="space-y-2">
      <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
        <Icon name="edit" className="mr-1 inline h-4 w-4 align-[-3px]" />조건 고치기 ({result.answers.length}개) {editing ? "▲" : "▼"}
      </button>
      {editing && <ConditionEditor answers={result.answers} onChange={onEdit} />}
    </section>
  ) : null;

  const saveBar = result ? (
    <div className="fixed inset-x-0 bottom-0 z-20">
      <div className="pointer-events-none h-8 bg-gradient-to-b from-transparent to-slate-50/95" />
      <div className="bg-slate-50/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgb(15_23_42/8%)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-lg space-y-1">
      {!saved ? (
        <>
          <button onClick={onSave} className="w-full rounded-2xl bg-indigo-600 py-3 font-semibold text-white shadow active:scale-95">
            <Icon name="bell" className="mr-1 inline h-5 w-5 align-[-4px]" />{result.matches.length ? "이 조건으로 알림 받기" : "이 조건으로 새 공고 오면 알림 받기"}
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
      </div>
    </div>
  ) : null;

  if (!result || result.matches.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-16 text-center">
        <Icon name="smile" className="h-12 w-12 text-indigo-500" />
        <p className="text-slate-600">{result ? "지금 조건에 맞는 공고가 없어요." : "아직 결과가 없어요."}</p>
        {relax.length > 0 && (
          <div className="w-full text-left">
            <RelaxSuggestions options={relax} onRelax={onRelax} title="이 조건을 풀면 공고가 생겨요" />
          </div>
        )}
        {result?.pool?.length ? (
          <Link href="/result/analysis" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            <Icon name="analysis" className="mr-1 inline h-4 w-4 align-[-3px]" />왜 없을까? 분석 보기
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
  const eligible = selectedMatches.filter((m) => m.status === "eligible").length;
  const rest = sorted.length - shown.length;
  const domains = [...domainCounts.entries()].filter(([, count]) => count > 0);

  return (
    <main className="flex flex-1 flex-col gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          ← 처음으로
        </Link>
        {result.pool?.length ? (
          <span className="flex items-center gap-2">
            <Link href="/settings" className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <Icon name="settings" className="h-4 w-4" />설정
            </Link>
            <Link href="/result/analysis" className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <Icon name="analysis" className="h-4 w-4" />분석 보기
            </Link>
          </span>
        ) : null}
      </header>

      <div>
        <h1 className="text-2xl font-bold">딱 맞는 공고를 찾았어요</h1>
        <p className="text-sm text-slate-500">
          전체 {selectedMatches.length}개 · 바로 신청 {eligible}개
        </p>
      </div>

      {domains.length >= 2 && (
        <nav aria-label="결과 분야" className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={tab === "all"} onClick={() => selectTab("all")} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${tab === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            전체 {result.matches.length}
          </button>
          {domains.map(([domain, count]) => {
            const meta = DOMAIN_META[domain];
            return (
              <button key={domain} type="button" aria-pressed={tab === domain} onClick={() => selectTab(domain)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${tab === domain ? "text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`} style={tab === domain ? { backgroundColor: meta.color } : undefined}>
                <span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-md text-white align-[-4px]" style={{ backgroundColor: tab === domain ? "rgb(255 255 255 / 18%)" : meta.color }} aria-hidden>
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                </span>
                {meta.label} {count}
              </button>
            );
          })}
        </nav>
      )}

      {result.radiusExcluded ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <span>반경 밖 {result.radiusExcluded}건을 제외했어요.</span>
          <Link href="/play" className="min-h-11 shrink-0 content-center rounded-xl bg-white px-3 font-semibold ring-1 ring-amber-200">
            반경 넓히기
          </Link>
        </div>
      ) : null}

      {selectedMatches.some((match) => match.opportunity.geo) ? (
        <ResultMap ref={mapRef} matches={sortedAll} location={result.location} onSelect={selectFromMap} />
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
            <Icon name="target" className="mr-1 inline h-4 w-4 align-[-3px]" />질문 더 해서 좁히기
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
