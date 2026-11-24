"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AnswerButtons from "@/components/game/AnswerButtons";
import RemainingGauge from "@/components/game/RemainingGauge";
import styles from "@/components/game/game.module.css";
import { Icon } from "@/components/brand/Icons";
import { LocationStep } from "@/components/game/LocationStep";
import { applyAnswer, defaultQuestionText, getMatches, questionId, rankQuestions, remaining, startGame, type GameState, type RankedQuestion } from "@/lib/engine";
import { nonEmptyResultState, readLastResult, saveLastResult } from "@/components/result/lastResult";
import { INCOME_THRESHOLDS, NCS_FIELDS } from "@/lib/engine/choices";
import { OPEN_FIELD, UNSPECIFIED_FIELD } from "@/lib/sources/field";
import { filterMatchesByRadius, type UserLocation } from "@/lib/geo/distance";
import { nearestRegion } from "@/lib/geo/regions";
import type { Answer, AnswerRecord, Domain, Opportunity, Question } from "@/lib/types";
import { LogoSymbol } from "@/components/brand/Logo";
import { answerGroups } from "@/lib/engine/answer-groups";
import { attachRefinement, refinementValue, type Refinement } from "@/lib/ai/refinement";
import { ruleRefinement } from "@/lib/ai/refinement-rules";

const DOMAIN_NAME: Record<string, string> = { housing: "청년 주택", benefit: "지원금·혜택", job: "채용·인턴", parttime: "알바·단기직", training: "국비 과정", exam: "자격증 일정" };
type LocationStage = "location" | "questions";
const PICKER_ATTRS = new Set<Question["attr"]>(["interest", "education", "field", "need", "housingKind", "region", "incomePct", "age", "employment"]);

function makeQuestion(attr: Question["attr"], value: Question["value"], op: Question["op"] = "eq"): Question {
  const q = { attr, op, value, id: "", text: "" };
  q.id = questionId(q);
  q.text = defaultQuestionText(q);
  return q;
}

type FeedbackType = "shown" | "answered" | "unknown" | "skipped" | "undo";

function sendQuestionFeedback(key: string | undefined, type: FeedbackType, before: number, after: number) {
  if (!key) return;
  void fetch("/api/question-feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, type, before, after }),
    keepalive: true,
  }).catch(() => {});
}

/** 홈에서 고른 분야는 이미 답한 것으로 둔다(같은 질문을 다시 묻지 않음) */
const pickedInterests = (domains: Domain[]): AnswerRecord[] => domains.length ? Object.keys(DOMAIN_NAME).map((d) => ({ question: makeQuestion("interest", d), answer: domains.includes(d as Domain) ? "yes" : "no" })) : [];

// 맞춤도를 위해 최대 12문항(서로 다른 조건만, 지역·소득·나이·취업 상태는 한 번에 고르기). 2문항부터 언제든 바로 결과 보기 가능
const MAX_QUESTIONS = 12;
const MORE_QUESTIONS = 5;
const MIN_KEEP = 10; // 기본 질문 3개 뒤 남은 후보가 이 수 이하로 줄면 질문을 멈춘다
// 결과에서 "질문 더 해서 좁히기"를 누르면 추가로 묻는 수

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

/** 예/아니오 대신 한 번에 고르는 질문(지역·소득). 고른 답은 여러 예/아니오 답으로 기록합니다 */
interface Choice {
  title: string;
  group: string;
  options: { label: string; picks: AnswerRecord[]; count?: number }[];
  unknown: AnswerRecord[]; // "모름": 관련 질문을 모두 모름으로
  multi?: boolean; // 여러 개 고르기: 고른 것은 예, 안 고른 것은 아니오
  unknownLabel?: string;
  rest?: AnswerRecord[]; // 여러 개 고르기에서 화면에 못 보인 나머지 값(고르면 "아니오"로 처리해 같은 질문 반복 방지)
  help?: string;
}

const aliveOpps = (s: GameState) => {
  const alive = new Set(getMatches(s).map((m) => m.opportunity.id));
  return s.pool.filter((o) => alive.has(o.id));
};

/** 지역: "○○에 거주합니까?"를 여러 번 묻지 않고 후보에 나온 지역(공고 많은 순) 중에서 고른다 */
function regionChoice(s: GameState): Choice | null {
  const count = new Map<string, number>();
  for (const o of aliveOpps(s)) for (const r of o.region) count.set(r, (count.get(r) ?? 0) + 1);
  const regions = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r]) => r);
  if (!regions.length) return null;
  const ask = (r: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("region", r), answer });
  return {
    title: "지금 어디에 살고 있습니까?",
    group: "사는 지역",
    options: [
      ...regions.map((r) => ({ label: r, picks: [ask(r, "yes")] })),
      { label: "해당 없음", picks: regions.map((r) => ask(r, "no")) },
    ],
    unknown: regions.map((r) => ask(r, "unknown")),
    unknownLabel: "모름",
    help: "지역 제한이 없는 전국 대상 공고는 어느 지역을 골라도 그대로 남습니다.",
  };
}

/** 소득: 현실적으로 답할 수 있는 100% 이하 구간과 100% 초과만 고른다. */
function incomeChoice(s: GameState): Choice | null {
  const values = new Set<number>();
  for (const o of aliveOpps(s))
    for (const c of o.conditions) if (c.attr === "incomePct" && c.op === "lte" && typeof c.value === "number") values.add(c.value);
  if (!values.size) return null;
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("incomePct", v, "lte"), answer });
  // 공고에 120·150% 같은 기준이 있어도 선택지는 100% 이하로만 보여 주고, 답 하나로 모든 기준을 한 번에 정리합니다(같은 질문 반복 방지)
  const all = [...new Set([...values, ...INCOME_THRESHOLDS])].sort((a, b) => a - b);
  const resolve = (low: number, high: number | null): AnswerRecord[] =>
    all.map((v) => ask(v, v < low ? "no" : high !== null && v >= high ? "yes" : "unknown"));
  return {
    title: "가구 소득은 기준중위소득의 몇 % 정도입니까?",
    group: "소득 구간",
    options: [
      ...INCOME_THRESHOLDS.map((v, i) => ({
        label: i === 0 ? `${v}% 이하` : `${INCOME_THRESHOLDS[i - 1] + 1}~${v}%`,
        // 내 소득이 (이전 기준, v] 구간: 이전 기준 이하 조건은 아니오, v 이상 조건은 예
        picks: resolve(i === 0 ? 0 : INCOME_THRESHOLDS[i - 1] + 1, v),
      })),
      // 100% 초과: 100% 이하 기준은 아니오, 그보다 높은 기준(120·150%)은 확인 필요
      { label: "100% 초과", picks: resolve(101, null) },
    ],
    unknown: all.map((v) => ask(v, "unknown")),
    unknownLabel: "모름",
  };
}

/** 나이: "34세 이하? 29세 이하?"를 반복하지 않고 구간 하나를 고른다 */
function ageChoice(s: GameState): Choice | null {
  const set = new Set<number>();
  const every = new Set<number>(); // 39세 이상 같은 기준도 답 하나로 함께 정리(다시 묻지 않게)
  for (const o of aliveOpps(s))
    for (const c of o.conditions) if (c.attr === "age" && c.op === "lte" && typeof c.value === "number") {
      every.add(c.value);
      if (c.value >= 20 && c.value < 39) set.add(c.value);
    }
  const all = [...every].sort((a, b) => a - b);
  const t = [...set].sort((a, b) => a - b).slice(-5);
  if (!t.length) return null;
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("age", v, "lte"), answer });
  // 버튼은 5구간만 보여 주되, 답 하나로 모든 나이 기준에 한꺼번에 답합니다(같은 질문 반복 방지)
  const resolve = (low: number, high: number | null): AnswerRecord[] =>
    all.map((v) => ask(v, v < low ? "no" : high !== null && v >= high ? "yes" : "unknown"));
  return {
    title: "만 나이가 어떻게 됩니까?",
    group: "나이",
    options: [
      ...t.map((v, i) => ({ label: i === 0 ? `${v}세 이하` : `${t[i - 1] + 1}~${v}세`, picks: resolve(i === 0 ? 0 : t[i - 1] + 1, v) })),
      { label: `${t.at(-1)! + 1}세 이상`, picks: resolve(t.at(-1)! + 1, null) },
    ],
    unknown: all.map((v) => ask(v, "unknown")),
    unknownLabel: "모름",
  };
}

const EMPLOYMENT: [string, string][] = [["student", "학생(재학·휴학)"], ["jobseeker", "구직 중"], ["employed", "직장인"], ["parttime", "알바·단기 근로"]];
/** 취업 상태: 한 번에 고른다 */
function employmentChoice(): Choice {
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("employment", v), answer });
  return {
    title: "지금 어떤 상태입니까?",
    group: "취업 상태",
    options: EMPLOYMENT.map(([v, label]) => ({ label, picks: [ask(v, "yes")] })),
    unknown: EMPLOYMENT.map(([v]) => ask(v, "unknown")),
    unknownLabel: "모름",
  };
}

/** 학력: 단계 하나를 고른다 */
function educationChoice(): Choice {
  const ask = (v: number, answer: Answer): AnswerRecord => ({ question: makeQuestion("education", v, "gte"), answer });
  const levels: [number, string][] = [[1, "고졸 이하"], [2, "전문대졸"], [3, "대졸(4년제)"], [4, "석사"], [5, "박사"]];
  return {
    title: "최종 학력이 어떻게 됩니까?",
    group: "학력",
    options: levels.map(([n, label]) => ({ label, picks: [ask(n, "yes"), ...(n < 5 ? [ask(n + 1, "no")] : [])] })),
    unknown: levels.map(([n]) => ask(n, "unknown")),
    unknownLabel: "모름",
  };
}

/** 여러 개 고르기(직무 분야·필요한 지원): 남은 후보에 나온 값(많은 순, 최대 8개) */
function multiChoice(s: GameState, attr: "field" | "need", title: string, group: string): Choice | null {
  const count = new Map<string, number>();
  for (const o of aliveOpps(s))
    for (const c of o.conditions) if (c.attr === attr) for (const v of Array.isArray(c.value) ? c.value : [c.value]) count.set(String(v), (count.get(String(v)) ?? 0) + 1);
  const all = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  const fields = attr === "field"
    ? [
        // 직무가 적히지 않은 공고까지 볼지 직접 고른다(안 고르면 희망 분야로 확인된 공고만). 잘 보이게 맨 앞에 둔다
        ...(all.includes(OPEN_FIELD) ? [{ value: OPEN_FIELD, label: "직무 무관 일반 채용도 보기" }] : []),
        ...(all.includes(UNSPECIFIED_FIELD) ? [{ value: UNSPECIFIED_FIELD, label: "직무 미표기 공고도 보기" }] : []),
        ...NCS_FIELDS,
        ...all.filter((value) => !NCS_FIELDS.some((field) => field.value === value) && value !== UNSPECIFIED_FIELD && value !== OPEN_FIELD)
          .map((value) => ({ value, label: value })),
      ]
    : all.map((value) => ({ value, label: value }));
  const values = fields.map((field) => field.value);
  if (values.length < 2) return null;
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion(attr, v), answer });
  return {
    title,
    group,
    multi: true,
    options: fields.map(({ value, label }) => ({
      label,
      picks: [ask(value, "yes")],
      count: count.get(value) ?? 0,
    })),
    unknown: all.map((v) => ask(v, "unknown")),
    unknownLabel: attr === "field" ? "해당 분야 없음" : "해당 없음",
    rest: [],
  };
}

/** 주거 형태: 임대 / 분양 / 둘 다 */
function housingKindChoice(): Choice {
  const ask = (v: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("housingKind", v), answer });
  return {
    title: "어떤 집을 찾고 있습니까?",
    group: "주거 형태",
    options: [
      { label: "임대(월세·전세)", picks: [ask("rent", "yes")] },
      { label: "분양(내 집 마련)", picks: [ask("sale", "yes")] },
    ],
    unknown: [ask("rent", "unknown"), ask("sale", "unknown")],
    unknownLabel: "해당 없음",
  };
}

/** 관심 분야: "채용 필요? 알바 필요? 지원금 필요?"를 하나씩 묻지 않고 여러 개 고른다 */
function interestChoice(s: GameState): Choice | null {
  const answered = new Set(s.answers.filter((a) => a.question.attr === "interest").map((a) => String(a.question.value)));
  const domains = [...new Set(aliveOpps(s).map((o) => o.domain))].filter((d) => !answered.has(d));
  if (domains.length < 2) return null;
  const ask = (d: string, answer: Answer): AnswerRecord => ({ question: makeQuestion("interest", d), answer });
  return {
    title: "어떤 정보가 필요합니까? (여러 개)",
    group: "관심 분야",
    multi: true,
    options: domains.map((d) => ({ label: DOMAIN_NAME[d] ?? d, picks: [ask(d, "yes")] })),
    unknown: domains.map((d) => ask(d, "unknown")),
    unknownLabel: "해당 없음",
  };
}

function choiceFor(s: GameState, q: Question | null): Choice | null {
  if (!q) return null;
  if (q.attr === "interest") return interestChoice(s);
  if (q.attr === "education") return educationChoice();
  if (q.attr === "field") return multiChoice(s, "field", "어떤 분야 일을 찾습니까? (여러 개)", "직무 분야");
  if (q.attr === "need") return multiChoice(s, "need", "어떤 지원이 필요합니까? (여러 개)", "필요한 지원");
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
  const [refinements, setRefinements] = useState<Record<number, Refinement>>({});
  const [feedbackKeys, setFeedbackKeys] = useState<Record<number, string>>({});
  const [refineAttempted, setRefineAttempted] = useState<Record<number, boolean>>({});
  const [locationStage, setLocationStage] = useState<LocationStage>("location");
  const [narrowedFrom, setNarrowedFrom] = useState<number>();
  const [target, setTarget] = useState<number | null>(null); // 결과에서 "N개 이하로 좁히기": 남은 후보가 이 수 이하면 멈춘다
  const [location, setLocation] = useState<UserLocation>();
  const aiOff = useRef(false);
  const shownFeedback = useRef(new Set<string>());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // 결과 화면의 "추가 질문으로 좁히기": 지난 답을 이어서 3문항 더
    if (params.get("continue") === "1") {
      try {
        const last = readLastResult();
        if (last?.pool?.length) {
          setContinuing(true);
          setNarrowedFrom(last.matches.length);
          const answeredCount = answerGroups(last.answers ?? []).length;
          // 원하는 개수(target)가 있으면 그 수가 될 때까지 인터뷰하듯 더 묻는다(최대 12문항)
          const wanted = Number(params.get("target"));
          if (wanted > 0) setTarget(wanted);
          setLimit(answeredCount + (wanted > 0 ? 12 : MORE_QUESTIONS));
          setBase(answeredCount);
          setHistory([{ pool: last.pool, answers: last.answers ?? [] }]);
          setLocation(last.location);
          setLocationStage("questions");
          return;
        }
      } catch {}
    }
    const picked = (params.get("domains") ?? "").split(",").filter((d): d is Domain => d in DOMAIN_NAME);
    loadPool(null).then(({ pool, error }) => {
      setLoadError(error);
      const have = picked.filter((d) => pool.some((o) => o.domain === d));
      setMissing(picked.filter((d) => !have.includes(d)).map((d) => DOMAIN_NAME[d]));
      setHistory([{ ...startGame(pool), answers: pickedInterests(picked) }]);
    });
  }, []);

  const state = history?.at(-1) ?? null;
  const view = useMemo(() => {
    if (!state) return null;
    const left = remaining(state);
    const step = history!.length - 1;
    const asked = base + step; // 답한 질문 수(지역·소득 등 선택형은 한 번으로 셈)
    const grouped = new Set(state.answers.filter((a) => PICKER_ATTRS.has(a.question.attr)).map((a) => a.question.attr));
    const ranked: RankedQuestion[] = asked >= limit || stopNow ? [] : rankQuestions(state, 100).filter((r) => !grouped.has(r.question.attr)).slice(0, 5);
    const refine = refinements[step];
    // 원칙: 대화형 AI는 분류가 막혔을 때만 새 질문을 만든다.
    // 규칙 질문(정보 이득 1순위)으로 나눌 수 있으면 그대로 묻고 AI를 부르지 않는다. 막힘 = 남은 규칙 질문이 없거나,
    // 가장 좋은 예/아니오 질문도 후보를 10% 미만으로만 줄일 때(선택형 질문은 선택지별로 나뉘므로 막힘으로 보지 않음).
    // 막히면 추가 질문 경로: 공고 DB 분류 칼럼(Jev)으로 먼저 나누고, 그것도 안 될 때만 /api/refine-question이 AI로 생성
    const best = ranked[0];
    const weak = !!best && !choiceFor(state, best.question) && Math.max(best.yes, best.no) > left * 0.9;
    const needsRefine = !stopNow && left > 1 && asked < limit && (!ranked.length || weak);
    const refining = needsRefine && !refineAttempted[step];
    const waiting = refining;
    const chosen = waiting ? null : ranked[0] ?? null;
    const failedRefinement = needsRefine && !!refineAttempted[step] && !refine;
    // AI 추가 질문 생성이 실패해도(한도·장애) 규칙 기반 질문이 남아 있으면 그걸로 계속 묻는다(흐름이 멈추지 않게)
    const q = refine
      ? { ...makeQuestion("topic", refinementValue(refine, refine.options[0].label)), text: refine.text }
      : needsRefine && !failedRefinement ? null : chosen?.question ?? null;
    const noMore = ranked.length === 0 && !refine && !refining;
    // 첫 탐색은 규칙 질문이 다 떨어지면 AI 생성 실패여도 결과로 간다. 결과에서 "더 좁히기"로 온 경우만 다시 생성 화면을 보여 준다
    // 남은 후보가 최소 개수(10개) 이하가 되면 더 묻지 않고 결과로 간다(첫 탐색). "N개 이하로 좁히기"는 N 기준
    const done = stopNow || left <= 1 || (target !== null && left <= target) || (!continuing && target === null && step >= 3 && left <= MIN_KEEP) || asked >= limit || (noMore && !(continuing && failedRefinement) && !(continuing && step === 0)) ||
      // AI·규칙 모두 더 나눌 질문이 없으면 멈춰 있지 말고 지금까지의 결과로 돌아간다
      (failedRefinement && !(refine || chosen));
    let choice = choiceFor(state, q);
    if (refine) choice = {
      title: refine.text, help: `${refine.why} 분류 근거가 없는 공고는 유지합니다.`, group: "추가 맞춤 탐색",
      options: refine.options.map((option) => ({ label: option.label, picks: refine.options.map((other) => ({ question: { ...makeQuestion("topic", refinementValue(refine, other.label)), text: `${refine.text} — ${other.label}` }, answer: other.label === option.label ? "yes" : "no" })) })),
      unknown: refine.options.map((option) => ({ question: { ...makeQuestion("topic", refinementValue(refine, option.label)), text: `${refine.text} — ${option.label}` }, answer: "unknown" })),
    };
    return { left, asked, step, q, done, split: chosen ? { yes: chosen.yes, no: chosen.no } : null, choice, ranked, waiting, refining, byAi: !!refine, stuck: !done && failedRefinement && !q };
  }, [state, stopNow, limit, base, history, continuing, refinements, refineAttempted, target]);

  // 공고를 구분할 수 있는 축과 실제 답변 이력으로 AI가 질문·선택지를 생성합니다.
  const pickKey = view?.waiting ? view.step : null;
  useEffect(() => {
    if (pickKey === null || !view || !state) return;
    let alive = true;
    if (view.refining) {
      const candidates = aliveOpps(state);
      const buckets = Object.keys(DOMAIN_NAME).map((domain) => candidates.filter((o) => o.domain === domain));
      const sample: Opportunity[] = [];
      for (let i = 0; sample.length < 240 && buckets.some((b) => b[i]); i++) for (const b of buckets) if (b[i] && sample.length < 240) sample.push(b[i]);
      fetch("/api/refine-question", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(25000), body: JSON.stringify({ evidence: sample.map((o) => ({ id: o.id, domain: o.domain, title: o.title.slice(0, 160), summary: o.summary.slice(0, 240), tags: o.tags })), answered: state.answers.map((a) => ({ text: a.question.text, answer: a.answer })) }) })
        .then((r) => r.json()).catch(() => ({})).then((d: { question?: Refinement; feedbackKey?: string }) => {
          // AI가 질문을 못 만들면(한도·장애·근거 부족) 남은 공고 분포로 규칙 질문을 만든다
          const refinement = d.question ?? (continuing || !view.ranked.length ? ruleRefinement(candidates, state.answers) : null);
          if (!alive || !refinement) return;
          setHistory((h) => h ? [...h.slice(0, -1), { ...h.at(-1)!, pool: attachRefinement(h.at(-1)!.pool, refinement) }] : h);
          setRefinements((m) => ({ ...m, [pickKey]: refinement }));
          if (d.question && d.feedbackKey) {
            setFeedbackKeys((m) => ({ ...m, [pickKey]: d.feedbackKey! }));
          }
        }).catch(() => {}).finally(() => { if (alive) setRefineAttempted((m) => ({ ...m, [pickKey]: true })); });
      return () => { alive = false; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey]);

  useEffect(() => {
    if (!state || !state.pool.length || !view?.done) return;
    setFinishing(true);
    // 결과가 0건으로 끝나지 않게: 마지막 답(들)로 전부 걸러졌다면 공고가 남아 있던 직전 단계를 기준으로 보여 준다
    const { state: shown, note: fallbackNote } = nonEmptyResultState(history ?? [state]);
    const filtered = filterMatchesByRadius(getMatches(shown), location);
    const result = { answers: shown.answers, matches: filtered.matches, pool: shown.pool, location, radiusExcluded: filtered.excluded, narrowedFrom, fallbackNote };
    saveLastResult(result);
    const t = setTimeout(() => router.push("/result"), 900);
    return () => clearTimeout(t);
  }, [state, view?.done, router, location, narrowedFrom, history]);

  // ANTHROPIC_API_KEY가 있으면 서버에서 질문 문장을 다듬는다. 없으면 기본 문장 그대로.
  const skippedPicker = Boolean(view?.q && PICKER_ATTRS.has(view.q.attr) && !view.choice);
  const q = view?.done || skippedPicker ? null : (view?.q ?? null);
  useEffect(() => {
    if (!state || !view?.q || !skippedPicker) return;
    const skipped = { ...view.q, text: view.q.text || defaultQuestionText(view.q) };
    setSelected([]);
    setHistory((current) => current
      ? [...current, applyAnswer(current.at(-1)!, skipped, "unknown")]
      : current);
  }, [state, skippedPicker, view?.q]);

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
  const feedbackKey = view ? feedbackKeys[view.step] : undefined;

  useEffect(() => {
    if (!q || !view || !feedbackKey) return;
    const shownId = `${view.step}:${feedbackKey}`;
    if (shownFeedback.current.has(shownId)) return;
    shownFeedback.current.add(shownId);
    sendQuestionFeedback(feedbackKey, "shown", view.left, view.left);
  }, [q, view, feedbackKey]);

  const answer = (a: Answer) => {
    if (!state || !q) return;
    const next = applyAnswer(state, { ...q, text: shownText }, a);
    sendQuestionFeedback(feedbackKey, a === "unknown" ? "unknown" : "answered", remaining(state), remaining(next));
    setHistory([...(history ?? []), next]);
  };
  const pick = (picks: AnswerRecord[]) => {
    if (!state) return;
    const next = picks.reduce((s, p) => applyAnswer(s, p.question, p.answer), state);
    const unknown = picks.length > 0 && picks.every((p) => p.answer === "unknown");
    sendQuestionFeedback(feedbackKey, unknown ? "unknown" : "answered", remaining(state), remaining(next));
    setSelected([]);
    setHistory([...(history ?? []), next]);
  };
  // 여러 개 고르기 완료: 고른 것은 예, 안 고른 것은 아니오(하나도 안 고르면 상관없음)
  const submitMulti = (c: Choice) =>
    pick(selected.length ? [...c.options.flatMap((o) => o.picks.map((p) => ({ ...p, answer: (selected.includes(o.label) ? "yes" : "no") as Answer }))), ...(c.rest ?? [])] : c.unknown);
  const undo = () => {
    if (!history || history.length <= 1) return;
    const previousStep = history.length - 2;
    const previous = history.at(-2)!;
    const previousKey = feedbackKeys[previousStep];
    sendQuestionFeedback(previousKey, "undo", remaining(history.at(-1)!), remaining(previous));
    if (previousKey) shownFeedback.current.delete(`${previousStep}:${previousKey}`);
    setRefinements((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) < history.length - 1)));
    setRefineAttempted((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) < history.length - 1)));
    setHistory(history.slice(0, -1));
  };

  const completeLocation = (next: UserLocation) => {
    if (!state) return;
    setLocation(next);
    // 시도 경계가 아닌 17개 시도 중심점 중 최단 거리로 근사합니다.
    const region = nearestRegion(next.lat, next.lng);
    const question = makeQuestion("region", region);
    setHistory([{ ...state, answers: [...state.answers.filter((item) => item.question.attr !== "region"), { question, answer: "yes" }] }]);
    setLocationStage("questions");
  };

  if (!state || !view) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-500">
        <span className={styles.loader}>
          <span className="signal-loader"><LogoSymbol className="h-5 w-5 text-indigo-600" /></span>
          공고를 모으는 중…
        </span>
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

      <RemainingGauge
        remaining={view.left}
        total={state.pool.length}
        question={Math.min(view.asked + 1, limit)}
        estimate={limit}
      />
      {missing.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 break-keep">
          {missing.join("·")}은(는) 아직 연결된 공고가 없어 제외하고 검색합니다.
        </p>
      )}

      {view.stuck ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Icon name="smile" className="h-12 w-12 text-indigo-500" />
          <p className="text-lg font-bold break-keep">추가 질문 생성에 성공하지 못했습니다</p>
          <p className="text-sm text-slate-500 break-keep">남은 {view.left}개 공고의 차이를 확인할 질문을 다시 요청할 수 있습니다. 모든 자격이 확인됐다는 의미는 아닙니다.</p>
          <button onClick={() => setRefineAttempted((m) => ({ ...m, [view.step]: false }))} className="rounded-xl border px-4 py-3">추가 질문 다시 생성</button>
          <button onClick={() => setStopNow(true)} className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white">현재 조건으로 결과 보기</button>
        </section>
      ) : view.done ? (
        <section className={`${styles.cardIn} flex flex-1 items-center justify-center text-sm text-slate-500`}>
          <span className={styles.loader}>
            <span className="signal-loader"><LogoSymbol className="h-5 w-5 text-indigo-600" /></span>
            결과를 정리하는 중…
          </span>
        </section>
      ) : skippedPicker ? (
        <section className={`${styles.cardIn} flex flex-1 flex-col items-center justify-center gap-3 text-center`}>
          <span className="signal-loader"><LogoSymbol className="h-5 w-5 text-indigo-600" /></span>
          <p className="text-xl font-bold">
            {view.left > 0 ? `${view.left}개로 좁혔습니다!` : "딱 맞는 공고를 찾지 못했습니다"}
          </p>
          <p className="text-slate-500">결과를 정리하는 중…</p>
        </section>
      ) : view.waiting ? (
        <section className="flex flex-1 items-center justify-center text-sm text-slate-500">
          <span className={styles.loader}>
            <span className="signal-loader"><LogoSymbol className="h-5 w-5 text-indigo-600" /></span>
            남은 공고를 비교해 다음 질문을 만드는 중…
          </span>
        </section>
      ) : (
        view.q && (
          <section key={view.q.id} className={`${styles.cardIn} flex flex-1 flex-col justify-center gap-8`}>
            <div className="app-card space-y-4 p-6 text-center text-slate-900">
              <p data-testid="question" className="text-2xl font-bold leading-snug break-keep">{view.choice ? view.choice.title : shownText}</p>
              {view.choice?.help && (
                <p className="text-sm text-slate-500 break-keep">{view.choice.help}</p>
              )}
              {(aiText[view.q.id] || view.byAi) && (
                <p className="text-xs text-slate-400">{[view.byAi && "답변·공고 기반 AI 질문", aiText[view.q.id] && !view.choice && "AI 생성 문장"].filter(Boolean).join(" · ")}</p>
              )}
              {view.split && !view.choice && (
                <p className="text-xs text-slate-500">
                  예면 {view.split.yes}개, 아니오면 {view.split.no}개 남습니다
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
                        className={`min-h-12 rounded-xl px-2 py-3 text-base font-semibold shadow-sm ring-1 active:scale-[0.98] break-keep ${on ? "bg-indigo-600 text-white ring-indigo-600" : o.count === 0 ? "bg-slate-50 text-slate-400 ring-slate-200" : "bg-white text-slate-900 ring-slate-200"}`}
                      >
                        <span>{o.label}</span>
                        {o.count !== undefined && <span aria-hidden className="ml-1 text-xs font-normal">({o.count}건)</span>}
                      </button>
                    );
                  })}
                </div>
                {view.choice.multi && (
                  <button type="button" disabled={finishing || selected.length === 0} onClick={() => submitMulti(view.choice!)} className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40">
                    {selected.length ? `${selected.length}개 고르고 다음` : "1개 이상 선택"}
                  </button>
                )}
                <button type="button" disabled={finishing} onClick={() => pick(view.choice!.unknown)} className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600">
                  {view.choice.unknownLabel ?? "모름"}
                </button>
              </div>
            ) : (
              <AnswerButtons onAnswer={answer} disabled={finishing} />
            )}
            {view.asked >= base + 2 && (
              <button
                type="button"
                onClick={() => {
                  sendQuestionFeedback(feedbackKey, "skipped", view.left, view.left);
                  setStopNow(true);
                }}
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
        <span className="break-keep">모르면 &lsquo;모름&rsquo;를 선택하면 됩니다. 결과에서 확인할 점으로 알립니다.</span>
      </footer>
    </main>
  );
}
