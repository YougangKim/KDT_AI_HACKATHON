// 공고 분류 칼럼 목록 = 검수로 정한 기본 칼럼(RULE_FACETS) + AI 추가 질문으로 새로 생긴 칼럼.
// 새 칼럼이 등록되면 다음 공고 풀 수집 때 그 칼럼만 전체 공고에 한 번 분류한다(lib/server/pool.ts).
import { cacheKey, getCached, setCached } from "@/lib/ai/cache";
import { RULE_FACETS, type Facet } from "@/lib/ai/refinement-rules";
import type { Refinement } from "@/lib/ai/refinement";
import type { Domain } from "@/lib/types";

const NS = "facet-registry";
const KEY = "v1";
/** 새 칼럼 상한(칼럼마다 전체 공고 분류가 한 번 더 필요하므로 무한히 늘리지 않는다) */
export const MAX_DYNAMIC = 30;

const norm = (s: string) => s.replace(/[\s?？.!]/g, "");

export async function dynamicFacets(): Promise<Facet[]> {
  return (await getCached<Facet[]>(NS, KEY)) ?? [];
}

export async function allFacets(): Promise<Facet[]> {
  return [...RULE_FACETS, ...(await dynamicFacets())];
}

/** AI가 만든 추가 질문을 새 칼럼으로 등록한다. 같은 질문이 이미 있거나 상한이면 null */
export async function registerFacet(q: Refinement, domains: Domain[]): Promise<Facet | null> {
  if (!domains.length || q.options.length < 2) return null;
  const current = await dynamicFacets();
  if ([...RULE_FACETS, ...current].some((f) => norm(f.text) === norm(q.text))) return null;
  if (current.length >= MAX_DYNAMIC) return null;
  const facet: Facet = {
    id: `q_${cacheKey(`${q.text}|${q.options.map((o) => o.label).join("|")}`).slice(0, 10)}`,
    domains: [...new Set(domains)],
    text: q.text,
    why: q.why,
    options: q.options.map((o) => ({ label: o.label, terms: o.terms ?? [] })),
  };
  await setCached(NS, KEY, [...current, facet], 3650);
  return facet;
}
