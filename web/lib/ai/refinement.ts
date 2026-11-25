import { checkQuestionQuality } from "./question-guide";
import { hasCasualEnding } from "../copy";
import type { Opportunity } from "../types";
import { MIN_INFO, RULE_FACETS, expectedInfo } from "./refinement-rules";

export interface RefinementEvidence { id: string; title: string; summary: string; domain: string }
/** facet: 공고 분류 칼럼으로 만든 질문이면 그 칼럼 id(표본 밖 공고도 칼럼 값으로 나눈다) */
export interface Refinement { text: string; why: string; facet?: string; options: { label: string; ids: string[]; terms?: string[] }[] }

const EXAMPLES = 16;

/**
 * 모델 입력을 구조적으로 만든다(원문을 통째로 덧붙이지 않음).
 * - domains: 분야별 남은 후보 수(많은 순), focus: 후보가 가장 많은 분야 → 그 분야 안을 가르는 질문을 우선하게
 * - evidence: 후보 수 비율로 뽑은 대표 공고(작은 분야는 1건), 분야 안에서는 고르게 간격을 둔다. 제목·설명 80자
 * - axes: 검수한 세분화 축별 후보 분포(0건 선택지 제외), answered: 최근 답 5개
 */
export function refinementContext(evidence: RefinementEvidence[], answered: {text: string; answer: string}[]) {
  const total = evidence.length;
  const counts = new Map<string, RefinementEvidence[]>();
  for (const e of evidence) counts.set(e.domain, [...(counts.get(e.domain) ?? []), e]);
  const domains = [...counts.entries()].sort((a, b) => b[1].length - a[1].length).map(([domain, list]) => ({ domain, count: list.length }));
  const sample: {domain: string; title: string; summary: string}[] = [];
  const seen = new Set<string>();
  for (const { domain, count } of domains) {
    const list = counts.get(domain)!;
    const quota = Math.max(1, Math.round(EXAMPLES * count / Math.max(1, total)));
    // 같은 제목(반복 공고)은 건너뛰고 다음 후보로 채워 분야별 표본 수를 지킨다
    // 고르게 간격을 둔 위치부터 보고, 그다음 나머지 순서로 채운다
    const order = [...Array.from({ length: quota }, (_, i) => Math.floor(i * list.length / quota)), ...list.keys()];
    let taken = 0;
    for (const idx of order) {
      if (taken >= quota) break;
      const e = list[idx];
      if (seen.has(e.title)) continue;
      seen.add(e.title);
      sample.push({ domain, title: e.title.slice(0, 80), summary: e.summary.slice(0, 80) });
      taken++;
    }
  }
  const axes = RULE_FACETS.map((f) => ({ question: f.text, options: f.options.map((o) => ({ label: o.label, count: evidence.filter((e) => o.terms.some((t) => `${e.title} ${e.summary}`.includes(t))).length })).filter((o) => o.count > 0) }))
    .filter((a) => a.options.length >= 2);
  const recent = answered.slice(-5).map((a) => ({ text: a.text.slice(0, 72), answer: a.answer.slice(0, 20) }));
  return { total, domains, focus: domains[0]?.domain ?? null, axes, answered: recent, evidence: sample };
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
  // 정보량 기준: 후보가 적은 분야만 가르는(답해도 거의 안 줄어드는) 질문은 버린다
  if (expectedInfo(evidence.length, options.map((o) => o.ids.length), evidence.length - classified.size) < MIN_INFO) return null;
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
