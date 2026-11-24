// Jev 대상 판정 "관찰 모드": 자격요건 원문에 Jev 예/아니오를 물어 저장만 한다. 조건에는 반영하지 않는다.
// 목적: Jev로 LLM 조건 구조화를 대신해도 되는지(일치율·줄일 수 있는 호출·빠질 조건) 실제 공고로 측정하기 위함.
// 켜는 법: JEV_OBSERVE=1 + JEV_API_KEY. 결과는 원문 전체 해시 키로 영구 캐시(같은 원문이면 다시 묻지 않음)
import type { AttrKey, Condition } from "../types";
import { getCached, setCached } from "./cache";
import { askJev, jevEnabled, type JevQuestion } from "./jev";

export const TARGET_JUDGE_VERSION = "targets-v1";
const STATE_CHARS = 1500;
/** 수집 1회(collectLiveOpportunities 호출)에서 새로 묻는 최대 공고 수 */
export const OBSERVE_LIMIT = 200;

/** 대상 여부 질문(속성별). 숫자는 묻지 않고 "적혀 있는가"만 묻는다 */
const TARGETS: Partial<Record<AttrKey | "student" | "jobseeker" | "employed", string>> = {
  homeless: "무주택자만 신청할 수 있다고 적혀 있는가?",
  livingAlone: "1인 가구(부모와 따로 사는 사람)만 신청할 수 있다고 적혀 있는가?",
  student: "대학생(재학·휴학생)을 대상으로 한다고 적혀 있는가?",
  jobseeker: "미취업자·구직자를 대상으로 한다고 적혀 있는가?",
  employed: "재직자·근로자를 대상으로 한다고 적혀 있는가?",
  married: "신혼부부를 대상으로 한다고 적혀 있는가?",
  welfare: "기초생활수급자·차상위계층만 대상으로 한다고 적혀 있는가?",
  subscription: "주택청약종합저축(청약통장) 가입이 필요하다고 적혀 있는가?",
};
const PRESENCE = {
  hasAge: "나이(연령) 제한이 적혀 있는가?",
  hasIncome: "소득 기준(중위소득·연소득 등)이 적혀 있는가?",
} as const;

export type TargetObservation = Record<string, number>; // 질문 키 → '예' 확률

export function observeEnabled(): boolean {
  return process.env.JEV_OBSERVE === "1" && jevEnabled();
}

function questions(): Record<string, JevQuestion> {
  return Object.fromEntries(
    Object.entries({ ...TARGETS, ...PRESENCE }).map(([k, q]) => [k, { type: "noul" as const, instructions: q as string }]),
  );
}

// 캐시 키는 원문 전체(앞부분이 같은 다른 공고가 같은 값을 공유하지 않게). Jev에는 앞 1,500자만 보낸다
const cacheInput = (raw: string) => `${TARGET_JUDGE_VERSION}\n${raw}`;

/** 저장된 관찰 결과만 읽는다 */
export function cachedObservation(raw: string): Promise<TargetObservation | null> {
  return getCached<TargetObservation>("jev-targets", cacheInput(raw));
}

/** 원문에 Jev 대상 판정을 물어 저장한다. 실패하면 null(기존 동작에 영향 없음) */
export async function observeTargets(raw: string): Promise<TargetObservation | null> {
  if (!raw.trim()) return null;
  const hit = await cachedObservation(raw);
  if (hit) return hit;
  const answers = await askJev(`자격요건 원문:\n${raw.slice(0, STATE_CHARS)}`, questions());
  if (!answers) return null;
  const out: TargetObservation = {};
  for (const [k, a] of Object.entries(answers)) if (a.type === "noul") out[k] = a.noul;
  if (!Object.keys(out).length) return null;
  await setCached("jev-targets", cacheInput(raw), out, 365);
  return out;
}

// 수집 경로와 분리: 관찰은 기다리지 않고 한 줄로 차례차례(동시 호출 폭주·수집 지연 방지)
let observeLeft = 0;
let observeChain: Promise<unknown> = Promise.resolve();
/** 이미 예약한 원문(같은 원문을 두 번 예약하지 않음. 동시 수집에서도 공유) */
const scheduled = new Set<string>();

/** 수집 1회를 시작할 때 관찰 상한을 채운다(이미 남은 상한보다 줄이지 않아 동시 수집이 서로 깎지 않게) */
export function resetObserveBudget(limit = OBSERVE_LIMIT): void {
  observeLeft = observeEnabled() ? Math.max(observeLeft, limit) : 0;
}

/** 상한 안이면 관찰을 뒤에 예약한다. 반환: 예약했는지. 결과·수집 시간에는 영향 없음 */
export function scheduleObservation(raw: string): boolean {
  if (observeLeft <= 0 || !raw.trim() || scheduled.has(raw)) return false;
  observeLeft--;
  if (scheduled.size >= 5000) scheduled.clear(); // 오래 켜 둔 서버에서 메모리가 계속 늘지 않게(다시 예약돼도 캐시 적중)
  scheduled.add(raw);
  observeChain = observeChain.then(() => observeTargets(raw)).catch(() => null);
  return true;
}

/** 테스트용 */
export function _resetObservation(): Promise<unknown> {
  observeLeft = 0;
  scheduled.clear();
  return observeChain;
}

/** 조건 목록 → 관찰 질문 키와 같은 형태의 '있음' 집합(비교용) */
export function presentKeys(conds: Pick<Condition, "attr" | "value">[]): Set<string> {
  const s = new Set<string>();
  for (const c of conds) {
    if (c.attr === "age") s.add("hasAge");
    else if (c.attr === "incomePct") s.add("hasIncome");
    else if (c.attr === "employment") for (const v of Array.isArray(c.value) ? c.value : [c.value]) s.add(String(v));
    else s.add(c.attr);
  }
  return s;
}

export const OBSERVED_KEYS = [...Object.keys(TARGETS), ...Object.keys(PRESENCE)];
