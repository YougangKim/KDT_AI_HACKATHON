"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AnswerButtons from "@/components/game/AnswerButtons";
import RemainingGauge from "@/components/game/RemainingGauge";
import styles from "@/components/game/game.module.css";
import { LocationStep } from "@/components/game/LocationStep";
import { applyAnswer, defaultQuestionText, getMatches, questionId, rankQuestions, remaining, startGame, type GameState, type RankedQuestion } from "@/lib/engine";
import { readLastResult } from "@/components/result/lastResult";
import { filterMatchesByRadius, type UserLocation } from "@/lib/geo/distance";
import { nearestRegion } from "@/lib/geo/regions";
import type { Answer, AnswerRecord, Domain, Opportunity, Question } from "@/lib/types";

const DOMAIN_NAME: Record<string, string> = { housing: "청년 주택", benefit: "지원금·혜택", job: "채용·인턴", parttime: "알바·단기직", training: "국비 과정", exam: "자격증 일정" };
type LocationStage = "location" | "questions";

function makeQuestion(attr: Question["attr"], value: Question["value"], op: Question["op"] = "eq"): Question {
  const q = { attr, op, value, id: "", text: "" };
  q.id = questionId(q);
  q.text = defaultQuestionText(q);
  return q;
}

/** 홈에서 고른 분야는 이미 답한 것으로 둔다(같은 질문을 다시 묻지 않음) */
const pickedInterests = (domains: Domain[]): AnswerRecord[] => domains.map((d) => ({ question: makeQuestion("interest", d), answer: "yes" }));

// 맞춤도를 위해 최대 12문항(서로 다른 조건만, 지역·소득·나이·취업 상태는 한 번에 고르기). 2문항부터 언제든 바로 결과 보기 가능
const MAX_QUESTIONS = 12;
const MORE_QUESTIONS = 5; // 결과에서 "질문 더 해서 좁히기"를 누르면 추가로 묻는 수

async function loadPool(domains: string | null): Promise<{ pool: Opportunity[]; error: boolean }> {
  try {
    const res = await fetch(domains ? `/api/opportunities?domains=${encodeURIComponent(domains)}` : "/api/opportunities");
    if (res.ok) {
      const data = (await res.json()) as Opportunity[];
      if (Array.isArray(data)) return { pool: data.filter((o) => !o.isSample && o.origin !== "sample"), error: false };
    }
  } catch {
    // 조회 실패 시 가상 공고를 주입하지 않는다.
  }
  return { pool: [], error: true };
}

/** 예/아니오 대신 한 번에 고르는 질문(지역·소득). 고른 답은 여러 예/아니오 답으로 기록한다 */
interface Choice {
  title: string;
  group: string;
  options: { label: string; picks: AnswerRecord[] }[];
  unknown: AnswerRecord[]; // "모르겠어요": 관련 질문을 모두 모름으로
  multi?: boolean; // 여러 개 고르기: 고른 것은 예, 안 고른 것은 아니오
  unknownLabel?: string;
  rest?: AnswerRecord[]; // 여러 개 고르기에서 화면에 못 보인 나머지 값(고르면 "아니오"로 처리해 같은 질문 반복 방지)
}

const aliveOpps = (s: GameState) => {
  const alive = new Set(getMatches(s).map((m) => m.opportunity.id));
  return s.pool.filter((o) => alive.has(o.id));
};

/** 지역: "○○에 사나요?"를 여러 번 묻지 않고 후보에 나온 지역(공고 많은 순) 중에서 고른다 */
function regionChoice(s: GameState): Choice | null {
  const count = new Map<string, number>();
  for (const o of aliveOpps(s)) for (const r of o.region) count.set(r, (count.get(r) ?? 0) + 1);
  const regions = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r]) => r);
  if (!regions.length) return null;
  const ask = (r: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("region", r), answer });
  return {
    title: "지금 어디에 살고 있나요?",
    group: "사는 지역",
    options: [
      ...regions.map((r) => ({ label: r, picks: [ask(r, "yes")] })),
      { label: "목록에 없어요", picks: regions.map((r) => ask(r, "no")) },
    ],
    unknown: regions.map((r) => ask(r, "unknown")),
  };
}

/** 소득: "150% 이하? 140% 이하? 100% 이하?"를 반복하지 않고 구간 하나를 고른다 */
function incomeChoice(s: GameState): Choice | null {
  const freq = new Map<number, number>();
  for (const o of aliveOpps(s))
    for (const c of o.conditions)
      if (c.attr === "incomePct" && c.op === "lte" && typeof c.value === "number") freq.set(c.value, (freq.get(c.value) ?? 0) + 1);
  // 기준이 너무 많으면 자주 나오는 5개만 구간 경계로
  const t = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v).sort((a, b) => a - b);
  if (!t.length) return null;
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("incomePct", v, "lte"), answer });
  return {
    title: "가구 소득은 기준중위소득의 몇 % 정도인가요?",
    group: "소득 구간",
    options: [
      ...t.map((v, i) => ({
        label: i === 0 ? `${v}% 이하` : `${t[i - 1] + 1}~${v}%`,
        picks: [ask(v, "yes"), ...(i > 0 ? [ask(t[i - 1], "no")] : [])],
      })),
      { label: `${t.at(-1)}% 초과`, picks: [ask(t.at(-1)!, "no")] },
    ],
    unknown: t.map((v) => ask(v, "unknown")),
  };
}

/** 나이: "34세 이하? 29세 이하?"를 반복하지 않고 구간 하나를 고른다 */
function ageChoice(s: GameState): Choice | null {
  const set = new Set<number>();
  for (const o of aliveOpps(s))
    for (const c of o.conditions) if (c.attr === "age" && c.op === "lte" && typeof c.value === "number" && c.value >= 20 && c.value < 39) set.add(c.value);
  const t = [...set].sort((a, b) => a - b).slice(-5);
  if (!t.length) return null;
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("age", v, "lte"), answer });
  return {
    title: "만 나이가 어떻게 되나요?",
    group: "나이",
    options: [
      ...t.map((v, i) => ({ label: i === 0 ? `${v}세 이하` : `${t[i - 1] + 1}~${v}세`, picks: [ask(v, "yes"), ...(i > 0 ? [ask(t[i - 1], "no")] : [])] })),
      { label: `${t.at(-1)! + 1}세 이상`, picks: [ask(t.at(-1)!, "no")] },
    ],
    unknown: t.map((v) => ask(v, "unknown")),
  };
}

const EMPLOYMENT: [string, string][] = [["student", "학생(재학·휴학)"], ["jobseeker", "구직 중"], ["employed", "직장인"], ["parttime", "알바·단기 근로"]];
/** 취업 상태: 한 번에 고른다 */
function employmentChoice(): Choice {
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("employment", v), answer });
  return {
    title: "지금 어떤 상태인가요?",
    group: "취업 상태",
    options: EMPLOYMENT.map(([v, label]) => ({ label, picks: [ask(v, "yes")] })),
    unknown: EMPLOYMENT.map(([v]) => ask(v, "unknown")),
  };
}

/** 학력: 단계 하나를 고른다 */
function educationChoice(): Choice {
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("education", v, "gte"), answer });
  const levels: [number, string][] = [[1, "고졸 이하"], [2, "전문대졸"], [3, "대졸(4년제)"], [4, "석사"], [5, "박사"]];
  return {
    title: "최종 학력이 어떻게 되나요?",
    group: "학력",
    options: levels.map(([n, label]) => ({ label, picks: [ask(n, "yes"), ...(n < 5 ? [ask(n + 1, "no")] : [])] })),
    unknown: levels.map(([n]) => ask(n, "unknown")),
  };
}

/** 여러 개 고르기(직무 분야·필요한 지원): 남은 후보에 나온 값(많은 순, 최대 8개) */
function multiChoice(s: GameState, attr: "field" | "need", title: string, group: string): Choice | null {
  const count = new Map<string, number>();
  for (const o of aliveOpps(s))
    for (const c of o.conditions) if (c.attr === attr) for (const v of Array.isArray(c.value) ? c.value : [c.value]) count.set(String(v), (count.get(String(v)) ?? 0) + 1);
  const all = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  const values = all.slice(0, 8);
  if (values.length < 2) return null;
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion(attr, v), answer });
  return {
    title,
    group,
    multi: true,
    options: values.map((v) => ({ label: v, picks: [ask(v, "yes")] })),
    unknown: all.map((v) => ask(v, "unknown")),
    unknownLabel: "상관없어요",
    rest: all.slice(8).map((v) => ask(v, "no")),
  };
}

/** 주거 형태: 임대 / 분양 / 둘 다 */
function housingKindChoice(): Choice {
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("housingKind", v), answer });
  return {
    title: "어떤 집을 찾고 있나요?",
    group: "주거 형태",
    options: [
      { label: "임대(월세·전세)", picks: [ask("rent", "yes")] },
      { label: "분양(내 집 마련)", picks: [ask("sale", "yes")] },
    ],
    unknown: [ask("rent", "unknown"), ask("sale", "unknown")],
    unknownLabel: "둘 다 괜찮아요",
  };
}

/** 관심 분야: "채용 필요? 알바 필요? 지원금 필요?"를 하나씩 묻지 않고 여러 개 고른다 */
function interestChoice(s: GameState): Choice | null {
  const answered = new Set(s.answers.filter((a) => a.question.attr === "interest").map((a) => String(a.question.value)));
  const domains = [...new Set(aliveOpps(s).map((o) => o.domain))].filter((d) => !answered.has(d));
  if (domains.length < 2) return null;
  const ask = (d: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("interest", d), answer });
  return {
    title: "어떤 정보가 필요한가요? (여러 개)",
    group: "관심 분야",
    multi: true,
    options: domains.map((d) => ({ label: DOMAIN_NAME[d] ?? d, picks: [ask(d, "yes")] })),
    unknown: domains.map((d) => ask(d, "unknown")),
    unknownLabel: "전부 보여 주세요",
  };
}

function choiceFor(s: GameState, q: Question | null): Choice | null {
  if (!q) return null;
  if (q.attr === "interest") return interestChoice(s);
  if (q.attr === "education") return educationChoice();
  if (q.attr === "field") return multiChoice(s, "field", "어떤 분야 일을 찾나요? (여러 개)", "직무 분야");
  if (q.attr === "need") return multiChoice(s, "need", "어떤 지원이 필요한가요? (여러 개)", "필요한 지원");
  if (q.attr === "housingKind") return housingKindChoice();
  if (q.attr === "region") return regionChoice(s);
  if (q.attr === "incomePct" && q.op === "lte") return incomeChoice(s);
  if (q.attr === "age" && q.op === "lte") return ageChoice(s);
  if (q.attr === "employment") return employmentChoice();
  return null;
}

export default function PlayPage() {
  const router = useRouter();
  const [history, setHistory] = useState<GameState[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [stopNow, setStopNow] = useState(false);
  const [limit, setLimit] = useState(MAX_QUESTIONS);
  const [base, setBase] = useState(0); // 이어서 묻기일 때 이미 답한 수
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]); // 골랐지만 연결된 공고가 없는 분야
  const [continuing, setContinuing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]); // 여러 개 고르기 선택 중
  const [aiPick, setAiPick] = useState<Record<number, string>>({}); // 단계별 AI가 고른 질문 id("" = 규칙 1순위)
  const [locationStage, setLocationStage] = useState<LocationStage>("location");
  const [location, setLocation] = useState<UserLocation>();
  const aiOff = useRef(false);
  const pickOff = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // 결과 화면의 "추가 질문으로 좁히기": 지난 답을 이어서 3문항 더
    if (params.get("continue") === "1") {
      try {
        const last = readLastResult();
        if (last?.pool?.length) {
          setContinuing(true);
          setLimit((last.answers?.length ?? 0) + MORE_QUESTIONS);
          setBase(last.answers?.length ?? 0);
          setHistory([{ pool: last.pool, answers: last.answers ?? [] }]);
          setLocation(last.location);
          setLocationStage("questions");
          return;
        }
      } catch {}
    }
    const picked = (params.get("domains") ?? "").split(",").filter((d): d is Domain => d in DOMAIN_NAME);
    loadPool(params.get("domains")).then(({ pool, error }) => {
      setLoadError(error);
      const have = picked.filter((d) => pool.some((o) => o.domain === d));
      setMissing(picked.filter((d) => !have.includes(d)).map((d) => DOMAIN_NAME[d]));
      setHistory([{ ...startGame(pool), answers: pickedInterests(have) }]);
    });
  }, []);

  const state = history?.at(-1) ?? null;
  const view = useMemo(() => {
    if (!state) return null;
    const left = remaining(state);
    const step = history!.length - 1;
    const asked = base + step; // 답한 질문 수(지역·소득 등 선택형은 한 번으로 셈)
    const ranked: RankedQuestion[] = asked >= limit || stopNow ? [] : rankQuestions(state, 5);
    const picked = aiPick[step];
    // AI가 고른 질문이 있으면 그것, AI가 아직 고르는 중이면 대기, AI를 못 쓰면 규칙(정보 이득) 1순위
    const waiting = ranked.length > 1 && !pickOff.current && picked === undefined;
    const chosen = ranked.find((r) => r.question.id === picked) ?? (waiting ? null : ranked[0] ?? null);
    const q = chosen?.question ?? null;
    const noMore = ranked.length === 0;
    const done = stopNow || left === 0 || asked >= limit || (noMore && !(continuing && step === 0));
    const choice = choiceFor(state, q);
    return { left, asked, step, q, done, split: chosen ? { yes: chosen.yes, no: chosen.no } : null, choice, ranked, waiting, byAi: !!picked && chosen?.question.id === picked, stuck: continuing && step === 0 && noMore };
  }, [state, stopNow, limit, base, history, aiPick, continuing]);

  // 다음 질문을 AI(Gemini/Claude)가 고른다: 규칙 상위 5개 후보 + 이미 답한 내용 → 후보 id 하나. 실패·4초 초과면 규칙 1순위
  const pickKey = view?.waiting ? view.step : null;
  useEffect(() => {
    if (pickKey === null || !view || !state) return;
    let alive = true;
    const candidates = view.ranked.map((r) => ({ id: r.question.id, text: choiceFor(state, r.question)?.title ?? r.question.text, yes: r.yes, no: r.no, resolve: r.resolve }));
    const answered = state.answers.map((a) => ({ text: a.question.text, answer: a.answer }));
    fetch("/api/next-question", { method: "POST", body: JSON.stringify({ candidates, answered, total: view.left }), signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((d: { ai: boolean; id?: string }) => {
        if (!d.ai) pickOff.current = pickKey === 0 ? true : pickOff.current; // 처음부터 AI가 꺼져 있으면 이후 호출 안 함
        if (alive) setAiPick((m) => ({ ...m, [pickKey]: d.ai && d.id ? d.id : "" }));
      })
      .catch(() => alive && setAiPick((m) => ({ ...m, [pickKey]: "" })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey]);

  useEffect(() => {
    if (!state || !state.pool.length || !view?.done) return;
    setFinishing(true);
    const filtered = filterMatchesByRadius(getMatches(state), location);
    const result = { answers: state.answers, matches: filtered.matches, pool: state.pool, location, radiusExcluded: filtered.excluded };
    try {
      sessionStorage.setItem("lastResult", JSON.stringify(result));
    } catch {
      // 저장 실패해도 결과 화면으로 이동
    }
    const t = setTimeout(() => router.push("/result"), 900);
    return () => clearTimeout(t);
  }, [state, view?.done, router, location]);

  // ANTHROPIC_API_KEY가 있으면 서버에서 질문 문장을 다듬는다. 없으면 기본 문장 그대로.
  const q = view?.done ? null : (view?.q ?? null);
  useEffect(() => {
    if (!q || aiOff.current || aiText[q.id]) return;
    let alive = true;
    fetch("/play/phrase", { method: "POST", body: JSON.stringify({ attr: q.attr, op: q.op, value: q.value }) })
      .then((r) => r.json())
      .then((d: { ai: boolean; text?: string }) => {
        if (!d.ai) aiOff.current = true;
        else if (alive && d.text) setAiText((m) => ({ ...m, [q.id]: d.text! }));
      })
      .catch(() => (aiOff.current = true));
    return () => {
      alive = false;
    };
  }, [q, aiText]);
  const shownText = q ? (aiText[q.id] ?? q.text) : "";

  const answer = (a: Answer) => {
    if (!state || !q) return;
    setHistory([...(history ?? []), applyAnswer(state, { ...q, text: shownText }, a)]);
  };
  const pick = (picks: AnswerRecord[]) => {
    if (!state) return;
    setSelected([]);
    setHistory([...(history ?? []), picks.reduce((s, p) => applyAnswer(s, p.question, p.answer), state)]);
  };
  // 여러 개 고르기 완료: 고른 것은 예, 안 고른 것은 아니오(하나도 안 고르면 상관없음)
  const submitMulti = (c: Choice) =>
    pick(selected.length ? [...c.options.flatMap((o) => o.picks.map((p) => ({ ...p, answer: (selected.includes(o.label) ? "yes" : "no") as Answer }))), ...(c.rest ?? [])] : c.unknown);
  const undo = () => {
    if (!history || history.length <= 1) return;
    setAiPick((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) < history.length - 1)));
    setHistory(history.slice(0, -1));
  };

  const completeLocation = (next: UserLocation) => {
    if (!state) return;
    setLocation(next);
    // 시도 경계가 아닌 17개 시도 중심점 중 최단 거리로 근사한다.
    const region = nearestRegion(next.lat, next.lng);
    const question = makeQuestion("region", region);
    setHistory([{ ...state, answers: [...state.answers.filter((item) => item.question.attr !== "region"), { question, answer: "yes" }] }]);
    setLocationStage("questions");
  };

  if (!state || !view) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-500">
        <span className={styles.orb}>📰</span>&nbsp;공고를 모으는 중…
      </main>
    );
  }

  if (state.pool.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-bold">{loadError ? "공고 조회 실패" : "조회 가능한 공고 없음"}</h1>
        <p className="text-sm text-slate-500">현재 연결된 출처에서 공고를 가져오지 못했습니다. 예시 데이터는 제공하지 않습니다.</p>
        <button onClick={() => window.location.reload()} className="text-indigo-600 underline">다시 조회</button>
        <Link href="/" className="text-slate-500 underline">관심 분야 다시 선택</Link>
      </main>
    );
  }

  if (locationStage === "location") {
    return (
      <main className="flex flex-1 flex-col gap-6 py-6 text-slate-900">
        <header className="text-sm">
          <Link href="/" className="text-slate-500">← 처음으로</Link>
        </header>
        <LocationStep
          onComplete={completeLocation}
          onSkip={() => setLocationStage("questions")}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 py-6 text-slate-900">
      <header className="flex items-center justify-between text-sm">
        <Link href="/" className="text-slate-500">
          ← 처음으로
        </Link>
      </header>

      <RemainingGauge remaining={view.left} total={state.pool.length} />
      {missing.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 break-keep">
          {missing.join("·")}은(는) 아직 연결된 공고가 없어 제외하고 찾을게요.
        </p>
      )}

      {view.stuck ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-4xl" aria-hidden>🙆</p>
          <p className="text-lg font-bold break-keep">지금 답으로는 더 좁힐 질문이 없어요</p>
          <p className="text-sm text-slate-500 break-keep">남은 {view.left}개 공고는 지금까지 답한 조건으로 모두 판정됐어요. 결과에서 조건을 고치거나 알림을 받아 보세요.</p>
          <Link href="/result" className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white">결과로 돌아가기</Link>
        </section>
      ) : view.done ? (
        <section className={`${styles.cardIn} flex flex-1 flex-col items-center justify-center gap-3 text-center`}>
          <p className="text-5xl">
            <span className={styles.orb}>📰</span>
          </p>
          <p className="text-xl font-bold">
            {view.left > 0 ? `${view.left}개로 좁혔어요!` : "딱 맞는 공고를 못 찾았어요"}
          </p>
          <p className="text-slate-500">결과를 정리하는 중…</p>
        </section>
      ) : view.waiting ? (
        <section className="flex flex-1 items-center justify-center text-sm text-slate-500">
          <span className={styles.orb}>📰</span>&nbsp;다음 질문을 고르는 중…
        </section>
      ) : (
        view.q && (
          <section key={view.q.id} className={`${styles.cardIn} flex flex-1 flex-col justify-center gap-8`}>
            <div className="space-y-3 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-sm">
              <p className="text-sm font-medium text-indigo-500">
                질문 {view.asked + 1} / 약 {limit}
              </p>
              <p data-testid="question" className="text-2xl font-bold leading-snug break-keep">{view.choice ? view.choice.title : shownText}</p>
              {(aiText[view.q.id] || view.byAi) && (
                <p className="text-xs text-slate-400">{[view.byAi && "AI가 고른 질문", aiText[view.q.id] && !view.choice && "AI 생성 문장"].filter(Boolean).join(" · ")}</p>
              )}
              {view.split && !view.choice && (
                <p className="text-xs text-slate-500">
                  예면 {view.split.yes}개, 아니오면 {view.split.no}개 남아요
                </p>
              )}
            </div>
            {view.choice ? (
              <div className="space-y-3" role="group" aria-label={view.choice.group}>
                <div className={`grid gap-2 ${view.choice.group === "사는 지역" ? "grid-cols-4" : "grid-cols-2"}`}>
                  {view.choice.options.map((o) => {
                    const on = selected.includes(o.label);
                    return (
                      <button
                        key={o.label}
                        type="button"
                        disabled={finishing}
                        aria-pressed={view.choice!.multi ? on : undefined}
                        onClick={() => (view.choice!.multi ? setSelected(on ? selected.filter((x) => x !== o.label) : [...selected, o.label]) : pick(o.picks))}
                        className={`rounded-xl px-1 py-3 text-base font-semibold shadow-sm ring-1 active:scale-95 break-keep ${on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-900 ring-slate-200"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {view.choice.multi && (
                  <button type="button" disabled={finishing || selected.length === 0} onClick={() => submitMulti(view.choice!)} className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40">
                    {selected.length ? `${selected.length}개 고르고 다음` : "하나 이상 골라 주세요"}
                  </button>
                )}
                <button type="button" disabled={finishing} onClick={() => pick(view.choice!.unknown)} className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600">
                  {view.choice.unknownLabel ?? "모르겠어요"}
                </button>
              </div>
            ) : (
              <AnswerButtons onAnswer={answer} disabled={finishing} />
            )}
            {view.asked >= base + 2 && (
              <button
                type="button"
                onClick={() => setStopNow(true)}
                className="text-sm font-medium text-indigo-600 underline underline-offset-4"
              >
                여기까지만 답하고 바로 결과 보기 ({view.left}개)
              </button>
            )}
          </section>
        )
      )}

      <footer className="flex flex-col items-center gap-2 text-center text-xs text-slate-400">
        <button type="button" onClick={undo} disabled={history!.length <= 1 || finishing} className="text-sm text-slate-500 disabled:invisible">
          ↶ 이전 질문
        </button>
        <span className="break-keep">모르면 &lsquo;모르겠어요&rsquo;를 누르세요. 결과에서 확인할 점으로 알려 드려요.</span>
      </footer>
    </main>
  );
}
