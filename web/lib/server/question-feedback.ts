import {
  isPromoted,
  type FeedbackCounts,
} from "@/lib/ai/question-pool";
import { persistent, redis } from "./store";

export type FeedbackType = "shown" | "answered" | "unknown" | "skipped" | "undo";
export interface FeedbackEvent {
  key: string;
  type: FeedbackType;
  before: number;
  after: number;
}

interface QuestionDefinition {
  poolKey: string;
  value: unknown;
}

const counters = new Map<string, FeedbackCounts>();
const definitions = new Map<string, QuestionDefinition>();
const promoted = new Map<string, Set<string>>();
const rates = new Map<string, { count: number; expiresAt: number }>();

const emptyCounts = (): FeedbackCounts => ({
  shown: 0,
  answered: 0,
  unknown: 0,
  skipped: 0,
  undo: 0,
  reductionSum: 0,
});

/** 서버리스 인스턴스 간에도 공유되도록 Redis가 있으면 Redis 카운터로도 제한한다 */
export async function allowQuestionFeedbackShared(ip: string): Promise<boolean> {
  if (!allowQuestionFeedback(ip)) return false;
  if (!persistent()) return true;
  try {
    const key = `question:rate:${ip}:${Math.floor(Date.now() / 60_000)}`;
    const count = Number(await redis(["INCR", key]));
    if (count === 1) await redis(["EXPIRE", key, 120]);
    return count <= 30;
  } catch { return true; }
}

export function allowQuestionFeedback(ip: string, now = Date.now()): boolean {
  const found = rates.get(ip);
  const entry = !found || found.expiresAt <= now
    ? { count: 0, expiresAt: now + 60_000 }
    : found;
  entry.count++;
  rates.set(ip, entry);
  return entry.count <= 30;
}

export async function saveQuestionDefinition(
  key: string,
  poolKey: string,
  value: unknown,
): Promise<void> {
  const definition = { poolKey, value };
  definitions.set(key, definition);
  if (persistent()) {
    await redis(["SET", `question:def:${key}`, JSON.stringify(definition), "EX", 60 * 60 * 24 * 30]);
  }
}

async function definition(key: string): Promise<QuestionDefinition | null> {
  const local = definitions.get(key);
  if (local) return local;
  if (!persistent()) return null;
  const raw = await redis(["GET", `question:def:${key}`]) as string | null;
  return raw ? JSON.parse(raw) as QuestionDefinition : null;
}

const outcomeCount = (counts: FeedbackCounts) =>
  counts.answered + counts.unknown + counts.skipped;

export async function recordQuestionFeedback(event: FeedbackEvent): Promise<void> {
  const reduction = event.before > 0
    ? Math.max(0, Math.min(1, (event.before - event.after) / event.before))
    : 0;
  let counts: FeedbackCounts;
  if (persistent()) {
    const counterKey = `question:count:${event.key}`;
    await redis(["HINCRBY", counterKey, event.type, 1]);
    await redis(["HINCRBYFLOAT", counterKey, "reductionSum", reduction]);
    if (event.type === "shown") await redis(["EXPIRE", counterKey, 60 * 60 * 24 * 30]);
    // 노출·되돌리기는 승격을 바꾸지 않으므로 집계만 하고 끝낸다(Redis 명령 절감)
    if (event.type === "shown" || event.type === "undo") return;
    // shown보다 결과 이벤트가 먼저 도착한 경우 해당 결과를 암묵적인 1회 노출로 보정합니다.
    const raw = await redis(["HGETALL", counterKey]) as string[];
    const values = Object.fromEntries(
      Array.from({ length: raw.length / 2 }, (_, index) => [raw[index * 2], Number(raw[index * 2 + 1])]),
    );
    counts = { ...emptyCounts(), ...values };
    if (counts.shown < outcomeCount(counts)) {
      counts.shown = Number(await redis(["HINCRBY", counterKey, "shown", 1]));
    }
  } else {
    counts = counters.get(event.key) ?? emptyCounts();
    counts[event.type]++;
    if (event.type !== "shown" && event.type !== "undo" && counts.shown < outcomeCount(counts)) {
      counts.shown++;
    }
    counts.reductionSum += reduction;
    counters.set(event.key, counts);
  }
  if (!isPromoted(counts)) return;
  const saved = await definition(event.key);
  if (!saved) return;
  if (persistent()) {
    await redis(["SADD", `question:pool:${saved.poolKey}`, event.key]);
  } else {
    const values = promoted.get(saved.poolKey) ?? new Set<string>();
    values.add(event.key);
    promoted.set(saved.poolKey, values);
  }
}

export async function getPromotedQuestion(poolKey: string): Promise<unknown | null> {
  let keys: string[];
  if (persistent()) {
    keys = await redis(["SMEMBERS", `question:pool:${poolKey}`]) as string[];
  } else {
    keys = [...(promoted.get(poolKey) ?? [])];
  }
  for (const key of keys) {
    const saved = await definition(key);
    if (saved) return saved.value;
  }
  return null;
}

export function _clearQuestionFeedbackMemory(): void {
  counters.clear();
  definitions.clear();
  promoted.clear();
  rates.clear();
}
