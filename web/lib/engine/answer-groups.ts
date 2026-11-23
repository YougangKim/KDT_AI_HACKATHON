import type { Answer, AnswerRecord } from "../types";

export type AnswerChange = { id: string; answer: Answer };
const GROUPED = new Set(["age", "incomePct", "region", "employment", "education", "interest", "field", "need", "housingKind"]);
export function answerGroups(answers: AnswerRecord[]): AnswerRecord[][] {
  const groups = new Map<string, AnswerRecord[]>();
  for (const item of answers) {
    const key = item.question.attr === "topic" ? `topic:${item.question.text.split(" — ")[0]}` : GROUPED.has(item.question.attr) ? item.question.attr : item.question.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}
export function updateAnswers(answers: AnswerRecord[], changes: AnswerChange[]): AnswerRecord[] {
  const byId = new Map(changes.map((c) => [c.id, c.answer]));
  return answers.map((item) => ({ ...item, answer: byId.get(item.question.id) ?? item.answer }));
}
export function numericChanges(group: AnswerRecord[], value: number | null): AnswerChange[] {
  return group.map(({ question: q }) => ({ id: q.id, answer: value === null ? "unknown" :
    (q.op === "lte" ? value <= Number(q.value) : q.op === "gte" ? value >= Number(q.value) : value === Number(q.value)) ? "yes" : "no" }));
}
export function numericRange(group: AnswerRecord[]): [number | null, number | null] {
  let lower: number | null = null, upper: number | null = null;
  for (const { question: q, answer } of group) {
    if (answer === "unknown") continue;
    const value = Number(q.value);
    if (q.op === "eq" && answer === "yes") return [value, value];
    if (q.op === "gte" && answer === "yes" || q.op === "lte" && answer === "no") lower = Math.max(lower ?? 0, value + (q.op === "lte" ? 1 : 0));
    if (q.op === "lte" && answer === "yes" || q.op === "gte" && answer === "no") upper = Math.min(upper ?? Infinity, value - (q.op === "gte" ? 1 : 0));
  }
  return [lower, upper];
}
