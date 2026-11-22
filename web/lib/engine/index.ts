import type {
  Answer,
  AnswerRecord,
  AttrKey,
  AttrValue,
  Condition,
  Match,
  Opportunity,
  Question,
} from "../types";
import { defaultQuestionText, domainLabel } from "./phrase";

export { defaultQuestionText } from "./phrase";

/** 게임 상태. 직렬화 가능한 값만 둔다(답변 기록에서 모든 것을 계산). */
export interface GameState {
  pool: Opportunity[];
  answers: AnswerRecord[];
}

type Verdict = "pass" | "fail" | "unknown" | null; // null = 아직 모름(안 물어봄)

/** 사용자가 답한 내용으로 알게 된 속성별 사실 */
interface Knowledge {
  lo: number;
  hi: number;
  bool?: boolean;
  is?: string;
  allowed?: string[];
  not: Set<string>;
  has: Set<string>; // interest처럼 값이 여러 개일 수 있는 속성
  unknownIds: Set<string>;
}

const MULTI: AttrKey[] = ["interest", "field", "need"];
/** 자격 요건이 아니라 취향인 속성: 묻지 않았다고 "확인 필요"로 남기지 않는다(아니오면 제외) */
const SOFT: AttrKey[] = ["interest", "field", "need", "housingKind"];
/** 질문의 의미를 이해하기 위해 먼저 확정해야 하는 속성 */
export const PREREQ: Partial<Record<AttrKey, AttrKey[]>> = {
  experienced: ["field"],
  education: ["field"],
  employment: ["field"],
  field: ["interest"],
  subscription: ["interest"],
  housingKind: ["interest"],
  married: ["interest"],
  welfare: ["interest"],
  need: ["interest"],
};

const arr = (v: Condition["value"]): AttrValue[] => (Array.isArray(v) ? v : [v]);
export const questionId = (c: Pick<Condition, "attr" | "op" | "value">) =>
  `${c.attr}:${c.op}:${String(c.value)}`;

const newKnowledge = (): Knowledge => ({
  lo: -Infinity,
  hi: Infinity,
  not: new Set(),
  has: new Set(),
  unknownIds: new Set(),
});

function learn(kb: Map<AttrKey, Knowledge>, q: Question, a: Answer) {
  const k = kb.get(q.attr) ?? newKnowledge();
  kb.set(q.attr, k);
  if (a === "unknown") {
    k.unknownIds.add(q.id);
    return;
  }
  const yes = a === "yes";
  const vals = arr(q.value);
  const v = vals[0];

  if (typeof v === "number") {
    if (q.op === "lte") {
      if (yes) k.hi = Math.min(k.hi, v);
      else k.lo = Math.max(k.lo, v + 1);
    }
    else if (q.op === "gte") {
      if (yes) k.lo = Math.max(k.lo, v);
      else k.hi = Math.min(k.hi, v - 1);
    }
    else if (q.op === "eq" && yes) k.lo = k.hi = v;
    return;
  }
  if (typeof v === "boolean") {
    if (q.op === "eq") k.bool = yes ? v : !v;
    return;
  }
  const strs = vals.map(String);
  if (MULTI.includes(q.attr)) {
    if (yes && strs.length === 1) k.has.add(strs[0]);
    if (!yes) strs.forEach((s) => k.not.add(s));
    return;
  }
  if (yes) {
    k.allowed = k.allowed ? k.allowed.filter((s) => strs.includes(s)) : strs;
    if (k.allowed.length === 1) k.is = k.allowed[0];
  } else {
    strs.forEach((s) => k.not.add(s));
  }
}

/** 서비스 대상이 청년(만 19~34세, 지자체 기준 최대 39세)이므로 나이 19~39를 기본 지식으로 둔다(만 19세 이상·만 60세 이상 같은 질문을 하지 않음) */
const YOUTH_MIN_AGE = 19;
const YOUTH_MAX_AGE = 39;
// 단일값 속성의 가능한 값 전체(아니오로 나머지가 모두 지워졌는지 판단할 때 사용)
const VALUE_DOMAIN: Partial<Record<AttrKey, string[]>> = { employment: ["student", "jobseeker", "employed", "parttime"] };

function buildKnowledge(answers: AnswerRecord[]): Map<AttrKey, Knowledge> {
  const kb = new Map<AttrKey, Knowledge>();
  kb.set("age", { ...newKnowledge(), lo: YOUTH_MIN_AGE, hi: YOUTH_MAX_AGE });
  for (const r of answers) learn(kb, r.question, r.answer);
  return kb;
}

function decide(k: Knowledge, c: Condition): "pass" | "fail" | null {
  const vals = arr(c.value);
  const v = vals[0];
  if (typeof v === "number") {
    if (c.op === "lte") return k.hi <= v ? "pass" : k.lo > v ? "fail" : null;
    if (c.op === "gte") return k.lo >= v ? "pass" : k.hi < v ? "fail" : null;
    const nums = vals as number[];
    if (k.lo === k.hi) return nums.includes(k.lo) ? "pass" : "fail";
    return nums.every((n) => n < k.lo || n > k.hi) ? "fail" : null;
  }
  if (typeof v === "boolean") {
    if (k.bool === undefined) return null;
    return vals.includes(k.bool) ? "pass" : "fail";
  }
  const strs = vals.map(String);
  if (MULTI.includes(c.attr)) {
    if (strs.some((s) => k.has.has(s))) return "pass";
    if (strs.every((s) => k.not.has(s))) return "fail";
    return null;
  }
  if (k.is !== undefined) return strs.includes(k.is) ? "pass" : "fail";
  const domain = VALUE_DOMAIN[c.attr];
  if (domain && !k.allowed && k.not.size > 0) {
    const left = domain.filter((s) => !k.not.has(s));
    if (left.length > 0 && left.every((s) => strs.includes(s))) return "pass";
  }
  const possible = (k.allowed ?? strs).filter((s) => !k.not.has(s));
  if (!strs.some((s) => possible.includes(s))) return "fail";
  if (k.allowed && k.allowed.filter((s) => !k.not.has(s)).every((s) => strs.includes(s))) return "pass";
  return null;
}

/**
 * 맞지 않아도 탈락시키지 않고 "확인 필요"로 남길 조건(맞으면 통과 근거로는 쓴다).
 * - 취업 상태: 알바 중이어도 그만두고 구직하거나 이직할 수 있어 지금 상태로 자르면 안 된다.
 * - 우대·우선·예외("가능", "무관")가 붙은 조건: 자격 요건이 아니다.
 * - 자동 해석이 불확실한 조건(confidence low).
 * - 기준중위소득이 아닌 소득 기준(연소득, 도시근로자 월평균소득, 학자금 구간): 질문은 기준중위소득으로 묻기 때문에 답으로 판정할 수 없다.
 */
export function lenient(c: Condition): boolean {
  if (c.attr === "employment" || c.confidence === "low") return true;
  if (/우대|우선|가능|무관|다름/.test(c.rawText)) return true;
  return c.attr === "incomePct" && !/중위/.test(c.rawText);
}

function evaluate(kb: Map<AttrKey, Knowledge>, c: Condition): Verdict {
  const k = kb.get(c.attr);
  if (!k) return null;
  const d = decide(k, c);
  if (d === "fail" && lenient(c)) return "unknown";
  if (d) return d;
  return k.unknownIds.has(questionId(c)) ? "unknown" : null;
}

/** 공고의 실제 판정 조건 + 지역·관심 분야 암묵 조건 */
interface Effective {
  cond: Condition;
  soft: boolean; // 관심 분야: 아니오면 탈락시키지만 "확인 필요"로는 남기지 않는다
}

function effectiveConditions(o: Opportunity): Effective[] {
  // 관심 분야는 자격 요건이 아니라 취향이므로, 묻지 않았다고 "확인 필요"로 남기지 않는다(답이 "아니오"면 여전히 제외)
  const out: Effective[] = o.conditions.map((cond) => ({ cond, soft: SOFT.includes(cond.attr) }));
  if (o.region.length > 0 && !o.conditions.some((c) => c.attr === "region")) {
    out.push({
      cond: {
        attr: "region",
        op: "in",
        value: o.region,
        rawText: `대상 지역: ${o.region.join(", ")}`,
        confidence: "high",
      },
      soft: false,
    });
  }
  if (!o.conditions.some((c) => c.attr === "interest")) {
    out.push({
      cond: {
        attr: "interest",
        op: "eq",
        value: o.domain,
        rawText: `관심 분야: ${domainLabel(o.domain)}`,
        confidence: "high",
      },
      soft: true,
    });
  }
  return out;
}

const alive = (kb: Map<AttrKey, Knowledge>, o: Opportunity) =>
  effectiveConditions(o).every((e) => evaluate(kb, e.cond) !== "fail");

export function startGame(pool: Opportunity[]): GameState {
  return { pool, answers: [] };
}

function candidates(s: GameState, kb = buildKnowledge(s.answers)) {
  return s.pool.filter((o) => alive(kb, o));
}

export function remaining(s: GameState): number {
  return candidates(s).length;
}

/** 후보들의 조건에서 질문 후보를 만든다(in 목록은 값별 eq 질문도 만든다) */
function questionPool(cands: Opportunity[]): Question[] {
  const seen = new Map<string, Question>();
  const add = (attr: AttrKey, op: Condition["op"], value: Condition["value"]) => {
    const q = { attr, op, value, id: "", text: "" };
    q.id = questionId(q);
    if (seen.has(q.id)) return;
    q.text = defaultQuestionText(q);
    seen.set(q.id, q);
  };
  for (const o of cands) {
    for (const { cond } of effectiveConditions(o)) {
      const strList = cond.op === "in" && Array.isArray(cond.value) && cond.value.every((v) => typeof v === "string");
      // 문자열 목록(in)은 "서울·경기 중?"보다 값별 질문("서울에 살아요?")이 자연스럽다
      if (strList) for (const v of cond.value as string[]) add(cond.attr, "eq", v);
      else add(cond.attr, cond.op, cond.value);
    }
  }
  return [...seen.values()];
}

const entropy = (p: number) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));

/**
 * 남은 후보를 가장 반반에 가깝게 나누는 질문을 고른다.
 * 점수 = 평균 탈락 비율 × 예/아니오 생존 균형(엔트로피) × 같은 속성 반복 감점.
 * 더 물어볼 의미 있는 질문이 없으면 null.
 */
function trivialForYouth(q: Question): boolean {
  if (q.attr !== "age" || typeof q.value !== "number") return false;
  return (q.op === "gte" && q.value <= 19) || (q.op === "lte" && q.value >= 39);
}

export interface RankedQuestion {
  question: Question;
  score: number;
  yes: number; // 예라고 답하면 남는 후보 수
  no: number; // 아니오라고 답하면 남는 후보 수
  resolve: number; // 이 질문으로 "확인 필요"가 풀리는(통과·탈락이 정해지는) 후보 수
}

/** 이 공고에서 attr 조건 중 아직 판정되지 않은(확인 필요) 것이 있는지 */
const pending = (kb: Map<AttrKey, Knowledge>, o: Opportunity, attr: AttrKey) =>
  effectiveConditions(o).some((e) => !e.soft && e.cond.attr === attr && evaluate(kb, e.cond) === null);

/**
 * 질문 후보를 점수순으로 돌려준다.
 * 점수 = 평균 탈락 비율 × 예/아니오 균형(엔트로피) + 확인 필요를 푸는 비율(맞춤 판정 가치) × 같은 속성 반복 감점.
 * 탈락시키지 않아도 "확인 필요"를 "바로 신청"으로 바꿔 주는 질문은 묻는다.
 */
export function rankQuestions(s: GameState, limit = 5): RankedQuestion[] {
  const kb = buildKnowledge(s.answers);
  const cands = candidates(s, kb);
  const n = cands.length;
  if (n === 0) return [];

  const askedIds = new Set(s.answers.map((r) => r.question.id));
  const attrCount = new Map<AttrKey, number>();
  for (const r of s.answers) attrCount.set(r.question.attr, (attrCount.get(r.question.attr) ?? 0) + 1);
  const lastAttr = s.answers.at(-1)?.question.attr;

  const pool = questionPool(cands);
  const candidateAttrs = new Set(pool.map((q) => q.attr));
  const out: RankedQuestion[] = [];
  for (const q of pool) {
    if (askedIds.has(q.id)) continue;
    const unansweredPrerequisite = (PREREQ[q.attr] ?? []).some(
      (attr) => candidateAttrs.has(attr) && !s.answers.some((answer) => answer.question.attr === attr),
    );
    if (unansweredPrerequisite) continue;
    const probe: Condition = { ...q, rawText: "", confidence: "high" };
    if (evaluate(kb, probe) !== null) continue; // 이미 답에서 알 수 있음
    if (trivialForYouth(q)) continue; // 청년(만 19~34세)이면 누구나 '예'인 나이 질문은 묻지 않음

    let yesAlive = 0;
    let noAlive = 0;
    let both = 0;
    let resolve = 0;
    const kbYes = buildKnowledge([...s.answers, { question: q, answer: "yes" }]);
    const kbNo = buildKnowledge([...s.answers, { question: q, answer: "no" }]);
    for (const o of cands) {
      const y = alive(kbYes, o);
      const no = alive(kbNo, o);
      if (y) yesAlive++;
      if (no) noAlive++;
      if (y && no) both++;
      if (pending(kb, o, q.attr) && (!pending(kbYes, o, q.attr) || !pending(kbNo, o, q.attr))) resolve++;
    }
    if (both === n && resolve === 0) continue; // 누구도 갈리지 않고 판정도 안 바뀜
    let score = (1 - (yesAlive + noAlive) / (2 * n)) * (0.5 + 0.5 * entropy(yesAlive / (yesAlive + noAlive)));
    if (yesAlive === 0 || noAlive === 0) score *= 0.3; // 한쪽 답이면 후보 전멸: 마지막 수단
    score += 0.25 * (resolve / n);
    if (q.attr === lastAttr) score *= 0.5;
    score *= 0.85 ** (attrCount.get(q.attr) ?? 0);
    if (s.answers.length === 0 && q.attr === "interest") score *= 2; // 첫 질문은 관심 분야부터
    if (score > 0) out.push({ question: q, score, yes: yesAlive, no: noAlive, resolve });
  }
  return out.sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id)).slice(0, limit);
}

export function nextQuestion(s: GameState): Question | null {
  return rankQuestions(s, 1)[0]?.question ?? null;
}

/** 답 기록. 같은 질문에 다시 답하면 덮어쓴다. */
export function applyAnswer(s: GameState, q: Question, a: Answer): GameState {
  return {
    ...s,
    answers: [...s.answers.filter((r) => r.question.id !== q.id), { question: q, answer: a }],
  };
}

const ANSWER_LABEL: Record<Answer, string> = { yes: "예", no: "아니오", unknown: "모름" };

/** AI가 해석한 조건에서 나온 근거 앞에 붙는 표시(결과 카드가 배지로 바꿔 보여 줌) */
export const AI_TAG = "[AI 해석] ";

export function getMatches(s: GameState): Match[] {
  const kb = buildKnowledge(s.answers);
  const matches: Match[] = [];
  for (const o of s.pool) {
    const eff = effectiveConditions(o);
    const verdicts = eff.map((e) => evaluate(kb, e.cond));
    if (verdicts.includes("fail")) continue;
    const reasons: string[] = [];
    const unknowns: Condition[] = [];
    eff.forEach((e, i) => {
      const v = verdicts[i];
      if (v === "pass") {
        const direct = s.answers.find((r) => r.question.id === questionId(e.cond));
        reasons.push((e.cond.aiGenerated ? AI_TAG : "") + (direct ? `${e.cond.rawText} (“${direct.question.text}” → ${ANSWER_LABEL[direct.answer]})` : e.cond.rawText));
        if (e.cond.confidence === "low") unknowns.push(e.cond);
      } else if (!e.soft) {
        unknowns.push(e.cond);
      }
    });
    matches.push({
      opportunity: o,
      status: unknowns.length === 0 ? "eligible" : "needs_check",
      reasons,
      unknowns,
    });
  }
  const end = (m: Match) => m.opportunity.applyEnd ?? "9999";
  return matches.sort(
    (a, b) =>
      (a.status === "eligible" ? 0 : 1) - (b.status === "eligible" ? 0 : 1) ||
      a.unknowns.length - b.unknowns.length ||
      end(a).localeCompare(end(b)),
  );
}
