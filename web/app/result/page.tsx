"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Domain } from "@/lib/types";
import type { AnswerChange } from "@/lib/engine/answer-groups";
import { analyzeFunnel } from "@/lib/insight/funnel";
import { RelaxSuggestions } from "@/components/result/RelaxSuggestions";
import { buildWatch, loadWatch, saveWatch } from "@/lib/alerts";
import { registerSW, requestPermission, checkAlerts, syncWatch, pushPublicKey, sendTestPush } from "@/lib/alerts/client";
import { MatchCard } from "@/components/result/MatchCard";
import { readLastResult, relaxAnswer, setAnswers, type LastResult, setFieldScope } from "@/components/result/lastResult";
import { OPEN_FIELD, UNSPECIFIED_FIELD } from "@/lib/sources/field";
import { ResultMap, type ResultMapHandle } from "@/components/result/ResultMap";
import { ConditionEditor } from "@/components/result/ConditionEditor";
import { applySortMode, interleaveByDomain, myRegion, SORT_LABEL, sortMatches, type SortMode } from "@/components/result/sort";
import { opportunityDistance } from "@/lib/geo/distance";
import { DOMAIN_META } from "@/components/result/domain";
import { Icon } from "@/components/brand/Icons";
import { FeedbackPrompt } from "@/components/result/FeedbackPrompt";

type AiSummary = { id: string; summary: string; how: string };
type ResultTab = "all" | Domain;

const FIRST = 6; // 한 페이지에 표시할 공고 수

export default function ResultPage() {
  const [result, setResult] = useState<LastResult | null | undefined>(undefined);
  const [highlighted, setHighlighted] = useState("");
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const [feedbackAt, setFeedbackAt] = useState(0); // 알림 저장 성공 시각 → 피드백 설문 제안
  const [summaries, setSummaries] = useState<Record<string, AiSummary>>({});
  const [summaryMs, setSummaryMs] = useState<Record<string, number>>({});

  const [hard, setHard] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ResultTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [limit, setLimit] = useState<number | null>(null); // 보고 싶은 공고 수(null = 전체)
  const mapRef = useRef<ResultMapHandle>(null);

  useEffect(() => {
    const loaded = readLastResult();
    setResult(loaded);
    // 이미 이 답으로 저장했다면 저장 버튼을 다시 보여 주지 않는다
    const w = loadWatch();
    const key = (a: { question: { id: string }; answer: string }[]) => a.map((x) => `${x.question.id}=${x.answer}`).sort().join("|");
    if (w && loaded && key(w.answers) === key(loaded.answers)) setSaved(true);
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
  // 더 물어볼 질문이 남아 있을 때만 "질문 더 해서 좁히기"를 연다(누르면 바로 "없습니다"가 되는 버튼 방지)

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
    setNote(`조건을 풀어서 ${gained}개 늘었습니다(${detail}).`);
    setResult(next);
  }

  function onScope(value: string, include: boolean) {
    if (!result) return;
    const next = setFieldScope(result, value, include);
    setNote(`채용 공고 범위를 바꿨습니다. ${result.matches.length}개 → ${next.matches.length}개`);
    setResult(next);
    setSaved(false);
  }

  function onEdit(changes: AnswerChange[]) {
    if (!result) return;
    const next = setAnswers(result, changes);
    setNote(`조건을 변경했습니다. ${result.matches.length}개 → ${next.matches.length}개`);
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
      setNote(`이 기기에는 저장했지만 서버 저장에 실패했습니다(${r.error ?? "알 수 없는 오류"}). 다시 눌러 재시도할 수 있습니다.`);
      return;
    }
    setSaved(true);
    if (p === "granted") {
      // 저장 즉시 알림이 실제로 오는지 보여 준다(새 공고 알림은 매일 조사 때 발송). 푸시가 안 되면 기기 알림으로 대신 표시
      const key = await pushPublicKey();
      const pushed = key ? await sendTestPush(key) : false;
      if (!pushed) {
        const reg = await registerSW();
        await reg?.showNotification("My News 알림 설정 완료", { body: "저장한 조건에 맞는 새 공고가 올라오면 이렇게 알려 드립니다.", icon: "/icon-192.png" }).catch(() => {});
      }
    }
    setFeedbackAt(Date.now());
    setNote(p === "granted" ? "저장했습니다. 매일 다시 찾아보고 새 공고·마감 임박을 알립니다." : "저장했습니다. 알림이 꺼져 있어 앱을 열 때 알림함에 표시합니다.");
  }

  async function onCheck() {
    const items = await checkAlerts();
    setNote(items.length ? "새 알림을 확인했습니다. 알림함에서 확인할 수 있습니다." : "이번 조회에서 새로 알릴 공고가 없습니다.");
  }


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
    const sorted = sortMatches(selectedMatches, myRegion(result.answers)).sort((a, b) => {
      if (!result.location) return 0;
      if (a.status !== b.status) return a.status === "eligible" ? -1 : 1;
      const da = opportunityDistance(result.location, a.opportunity);
      const db = opportunityDistance(result.location, b.opportunity);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    // 관련도순 전체 탭: 고른 분야가 골고루 보이도록 분야별로 번갈아 보여 준다. 다른 정렬은 그 기준대로
    const ordered = sortMode === "relevance" ? (tab === "all" ? interleaveByDomain(sorted) : sorted) : applySortMode(sorted, sortMode);
    return limit ? ordered.slice(0, limit) : ordered;
  }, [result, selectedMatches, tab, sortMode, limit]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sortedAll.length / FIRST) - 1));
  const selectFromMap = useCallback((id: string) => {
    const index = sortedAll.findIndex((m) => m.opportunity.id === id);
    if (index < 0) return;
    setPage(Math.floor(index / FIRST));
    setHighlighted(id);
  }, [sortedAll]);
  useEffect(() => {
    if (!highlighted) return;
    document.getElementById(`match-${encodeURIComponent(highlighted)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted, currentPage]);
  const firstIds = sortedAll.slice(currentPage * FIRST, (currentPage + 1) * FIRST).map((match) => match.opportunity.id).join("|");
  useEffect(() => {
    void requestSummaries(firstIds ? firstIds.split("|") : []);
  }, [firstIds, requestSummaries]);
  useEffect(() => {
    setPage(0);
    setHighlighted("");
  }, [tab, sortMode, limit]);

  function selectTab(next: ResultTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  if (result === undefined) return null;

  // 원하는 개수를 고르면 그 수 이하가 될 때까지 추가 질문으로 좁힌다(target 전달)
  const over = limit !== null && (result?.matches.length ?? 0) > limit;
  const narrowControl = result?.pool?.length ? (
      <Link href={over ? `/play?continue=1&target=${limit}` : "/play?continue=1"} className="block w-full rounded-2xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm">
        <Icon name="target" className="mr-1 inline h-4 w-4 align-[-3px]" />{over ? `추가 질문으로 ${limit}개 이하로 좁히기` : "추가 질문으로 더 좁히기"}
      </Link>
  ) : null;

  // 희망 직무를 고른 경우에만: 직무 무관 일반 채용·직무 미표기 공고를 결과에 넣을지 바로 고른다
  const pickedField = result?.answers.some((a) => a.question.attr === "field" && a.answer === "yes" && a.question.value !== OPEN_FIELD && a.question.value !== UNSPECIFIED_FIELD);
  const scopeCount = (value: string) => (result?.pool ?? []).filter((o) => o.conditions.some((c) => c.attr === "field" && Array.isArray(c.value) && c.value.includes(value))).length;
  const scopeOn = (value: string) => result?.answers.some((a) => a.question.id === `field:eq:${value}` && a.answer === "yes") ?? false;
  const scopeControls = pickedField && (scopeCount(OPEN_FIELD) + scopeCount(UNSPECIFIED_FIELD)) > 0 ? (
    <section className="app-card space-y-2 p-3 text-sm" aria-label="채용 공고 범위">
      <p className="font-semibold">채용 공고 범위 <span className="font-normal text-slate-500">· 기본은 고른 직무로 확인된 공고만</span></p>
      <div className="flex flex-wrap gap-2">
        {[{ value: OPEN_FIELD, label: "직무 무관 일반 채용도 보기" }, { value: UNSPECIFIED_FIELD, label: "직무 미표기 공고도 보기" }].filter((s) => scopeCount(s.value) > 0).map((s) => (
          <button key={s.value} type="button" aria-pressed={scopeOn(s.value)} onClick={() => onScope(s.value, !scopeOn(s.value))}
            className={`min-h-10 rounded-full border px-3 ${scopeOn(s.value) ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>
            {scopeOn(s.value) ? "✓ " : ""}{s.label}({scopeCount(s.value)}건)
          </button>
        ))}
      </div>
    </section>
  ) : null;

  const viewControls = (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="보기 설정">
      <label className="flex items-center gap-1">
        <span className="text-slate-600">정렬</span>
        <select aria-label="정렬" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="min-h-10 rounded-lg border bg-white px-2">
          {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => <option key={m} value={m}>{SORT_LABEL[m]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-slate-600">보고 싶은 수</span>
        <select aria-label="보고 싶은 공고 수" value={limit ?? ""} onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : null)} className="min-h-10 rounded-lg border bg-white px-2">
          <option value="">전체</option>
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n}개</option>)}
        </select>
      </label>
      {over && <span className="text-xs text-slate-500">상위 {limit}개만 표시 중 · 전체 {result?.matches.length ?? 0}개</span>}
    </div>
  );

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
            <Icon name="bell" className="mr-1 inline h-5 w-5 align-[-4px]" />{result.matches.length ? "이 조건으로 저장하고 알림 받기" : "이 조건으로 저장하고 새 공고 알림 받기"}
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
        <p className="text-slate-600">{result ? "지금 조건에 맞는 공고가 없습니다." : "아직 결과가 없습니다."}</p>
        {relax.length > 0 && (
          <div className="w-full text-left">
            <RelaxSuggestions options={relax} onRelax={onRelax} title="이 조건을 풀면 공고가 추가됩니다" />
          </div>
        )}
        {result?.pool?.length ? (
          <Link href="/result/analysis" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            <Icon name="analysis" className="mr-1 inline h-4 w-4 align-[-3px]" />왜 없을까? 분석 보기
          </Link>
        ) : null}
        <div className="w-full">{narrowControl}</div>
        <div className="w-full text-left">{editor}</div>
        <Link href="/" className="rounded-2xl bg-slate-100 px-6 py-3 font-semibold text-slate-700">
          {result ? "처음부터 다시" : "시작하기"}
        </Link>
        {saveBar}
      </main>
    );
  }

  const sorted = sortedAll;

  const shown = sorted.slice(currentPage * FIRST, (currentPage + 1) * FIRST);
  const eligible = selectedMatches.filter((m) => m.status === "eligible").length;
  const pages = Math.ceil(sorted.length / FIRST);
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
        <h1 className="text-2xl font-bold">맞춤 공고</h1>
        <p className="text-sm text-slate-500">
          전체 {selectedMatches.length}개 · 바로 신청 {eligible}개
        </p>
      </div>

      {result.fallbackNote && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900 break-keep">{result.fallbackNote}</p>
      )}

      {result.narrowedFrom !== undefined && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800">
          {result.narrowedFrom}개 → {result.matches.length}개로 좁혔습니다
        </p>
      )}

      {narrowControl}

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
          <span>반경 밖 {result.radiusExcluded}건을 제외했습니다.</span>
          <Link href="/play" className="min-h-11 shrink-0 content-center rounded-xl bg-white px-3 font-semibold ring-1 ring-amber-200">
            반경 넓히기
          </Link>
        </div>
      ) : null}

      {selectedMatches.some((match) => match.opportunity.geo) ? (
        <ResultMap ref={mapRef} matches={sortedAll} location={result.location} onSelect={selectFromMap} />
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">
          위치를 설정하면 공고를 지도로 볼 수 있습니다.
        </p>
      )}

      {relax.length > 0 && <RelaxSuggestions options={relax} onRelax={onRelax} title={`현재 ${result.matches.length}건. 조건을 완화하면 더 표시됩니다`} />}

      {scopeControls}
      {viewControls}

      <div className="space-y-3">
        {shown.map((m) => (
          <MatchCard
            key={m.opportunity.id}
            match={m}
            location={result.location}
            highlighted={highlighted === m.opportunity.id}
            aiSummary={summaries[m.opportunity.id]}
            summaryMs={summaryMs[m.opportunity.id]}
          />
        ))}
      </div>

      {pages > 1 && (
        <nav aria-label="공고 페이지" className="flex items-center justify-between gap-3">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-xl border px-4 py-3 disabled:opacity-40">이전</button>
          <span role="status">{currentPage + 1} / {pages} 페이지</span>
          <button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)} className="rounded-xl border px-4 py-3 disabled:opacity-40">다음</button>
        </nav>
      )}

      {editor}

      {saveBar}
      <FeedbackPrompt trigger={feedbackAt} />
    </main>
  );
}
