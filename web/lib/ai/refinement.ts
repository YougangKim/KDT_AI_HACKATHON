import { checkQuestionQuality } from "./question-guide";
import { hasCasualEnding } from "../copy";
import type { Opportunity } from "../types";
import { RULE_FACETS } from "./refinement-rules";

export interface RefinementEvidence { id: string; title: string; summary: string; domain: string }
/** facet: 공고 분류 칼럼으로 만든 질문이면 그 칼럼 id(표본 밖 공고도 칼럼 값으로 나눈다) */
export interface Refinement { text: string; why: string; facet?: string; options: { label: string; ids: string[]; terms?: string[] }[] }

/** 생성에는 분야별 대표 원문만 사용하고, 반환 구절은 전체 후보에 적용합니다. */
export function refinementContext(evidence: RefinementEvidence[], answered: {text: string; answer: string}[]) {
  const domains = [...new Set(evidence.map((e) => e.domain))];
  const buckets = domains.map((d) => evidence.filter((e) => e.domain === d));
  const sample: {title: string; summary: string; domain: string}[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 24 && sample.length < 24; round++) {
    for (const bucket of buckets) {
      const e = bucket[Math.floor(round * bucket.length / 24)];
      if (!e || seen.has(e.title)) continue;
      seen.add(e.title);
      const item = {title:e.title.slice(0,100),summary:e.summary.slice(0,100),domain:e.domain};
      if (JSON.stringify([...sample,item]).length > 3600 || sample.length >= 24) continue;
      sample.push(item);
    }
  }
  const history: {text:string;answer:string}[] = [];
  for (const a of [...answered].reverse()) {
    const item = {text:a.text.slice(0,140),answer:a.answer};
    if (JSON.stringify([...history,item]).length > 1600) break;
    history.push(item);
  }
  // 검수로 정한 세분화 축별로 전체 후보 분포를 알려 준다(AI가 실제로 갈리는 축을 고르도록)
  const axes = RULE_FACETS.map((f) => ({ question: f.text, options: f.options.map((o) => ({ label: o.label, count: evidence.filter((e) => o.terms.some((t) => `${e.title} ${e.summary}`.includes(t))).length })) }))
    .filter((a) => a.options.filter((o) => o.count > 0).length >= 2);
  return {evidence:sample,answered:history.reverse(),axes,total:evidence.length};
}

/** AI가 새로 만든 탐색 기준은 원문에 있는 검색 근거와 실제 후보 감소를 검증한다. */
export function validateRefinement(value: unknown, evidence: RefinementEvidence[], answered: { text: string }[]): Refinement | null {
  if (!value || typeof value !== "object") return null;
  const q = value as { text: string; why: string; options: { label: string; terms: string[] }[] };
  if (typeof q.text !== "string" || q.text.length < 8 || q.text.length > 140 || typeof q.why !== "string" || q.why.length > 180) return null;
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) return null;
  if (q.options.some((o) => !o || typeof o.label !== "string" || !o.label || o.label.length > 60 || !Array.isArray(o.terms) || !o.terms.length || o.terms.length > 12 || o.terms.some((t) => typeof t !== "string" || t.trim().length < 2 || t.length > 50))) return null;
  if ([q.text, q.why, ...q.options.map((o) => o.label)].some(hasCasualEnding)) return null;
  const normalize = (s: string) => s.replace(/[\s?？.!]/g, "");
  if (answered.some((a) => normalize(a.text.split(" — ")[0]) === normalize(q.text))) return null;
  if (new Set(q.options.map((o) => o.label)).size !== q.options.length) return null;
  // 어느 AI가 만들었든 같은 품질 기준(공용 지침)으로 거른다
  if (checkQuestionQuality(q.text, q.options.map((o) => o.label), answered)) return null;
  const options = q.options.map((o) => ({ label: o.label, terms: o.terms.map((t) => t.trim()), ids: evidence.filter((e) => o.terms.some((term) => `${e.title} ${e.summary}`.toLowerCase().includes(term.trim().toLowerCase()))).map((e) => e.id) }));
  if (options.some((o) => o.ids.length === 0)) return null;
  const classified = new Set(options.flatMap((o) => o.ids));
  // 선택지마다 적어도 하나 이상의 다른 후보가 빠져야 한다. 미분류 후보는 유지한다.
  if (options.some((o) => o.ids.length >= classified.size)) return null;
  return { text: q.text, why: q.why, options };
}

export function refinementValue(q: Refinement, label: string): string { return `${q.text} — ${label}`; }
export function attachRefinement(pool: Opportunity[], q: Refinement): Opportunity[] {
  return pool.map((o) => {
    const tag = q.facet ? o.tags?.[q.facet] : undefined;
    const byTag = tag !== undefined && tag !== "?";
    const groups = q.options.filter((option) => byTag ? tag === option.label : option.terms?.length ? option.terms.some((term) => `${o.title} ${o.summary}`.toLowerCase().includes(term.toLowerCase())) : option.ids.includes(o.id)).map((option) => refinementValue(q, option.label));
    return groups.length ? { ...o, conditions: [...o.conditions, { attr: "topic" as const, op: "in" as const, value: groups, confidence: "high" as const, rawText: `탐색 선호: ${q.text}` }] } : o;
  });
}
