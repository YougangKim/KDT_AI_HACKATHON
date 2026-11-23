import { hasCasualEnding } from "../copy";

export interface QuestionFacet {
  id: string;
  text: string;
  options: { key: string; label: string; remaining: number }[];
}
export interface GeneratedQuestion {
  id: string;
  text: string;
  why: string;
  options: { key: string; label: string }[];
}

/** AI는 문장과 선택지를 생성하지만 필터 연산은 검증된 키에만 연결합니다. */
export function validateQuestion(value: unknown, facets: QuestionFacet[], answered: { text: string }[], total: number): GeneratedQuestion | null {
  if (!value || typeof value !== "object") return null;
  const q = value as GeneratedQuestion;
  const facet = facets.find((f) => f.id === q.id);
  if (!facet || typeof q.text !== "string" || q.text.length < 8 || q.text.length > 160 || typeof q.why !== "string" || q.why.length > 180) return null;
  const normalize = (s: string) => s.replace(/[\s?？.!]/g, "");
  if (answered.some((a) => normalize(a.text) === normalize(q.text))) return null;
  if (!Array.isArray(q.options) || q.options.length !== facet.options.length || q.options.length < 2) return null;
  const keys = new Set(q.options.map((o) => o?.key));
  if (keys.size !== facet.options.length || facet.options.some((o) => !keys.has(o.key))) return null;
  if (q.options.some((o) => typeof o.label !== "string" || o.label.length < 1 || o.label.length > 80)) return null;
  if ([q.text, q.why, ...q.options.map((o) => o.label)].some(hasCasualEnding)) return null;
  if (new Set(q.options.map((o) => o.label)).size !== q.options.length) return null;
  if (!facet.options.some((o) => o.remaining > 0 && o.remaining < total)) return null;
  return { id: q.id, text: q.text.trim(), why: q.why.trim(), options: q.options.map(({ key, label }) => ({ key, label })) };
}
