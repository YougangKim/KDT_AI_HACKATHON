// 공고 수집 진입점. 키가 있으면 실제 API, 없거나 실패·0건이면 분야별 샘플로 폴백.
import type { Condition, Domain, Opportunity } from "../types";
import { aiEnabled, structureConditions } from "../ai";
import type { SourceAdapter } from "./types";
import { getEligibility, isOpen, todayKst } from "./util";
import { lhNotice } from "./lh-notice";
import { myhome } from "./myhome";
import { jobalio } from "./jobalio";
import { gov24 } from "./gov24";
import { youthcenter } from "./youthcenter";
import { work24Training } from "./work24-training";
import { qnet } from "./qnet";
import { searchWeb } from "./websearch";
import housing from "../../data/samples/housing.json";
import job from "../../data/samples/job.json";
import parttime from "../../data/samples/parttime.json";
import benefit from "../../data/samples/benefit.json";
import training from "../../data/samples/training.json";
import exam from "../../data/samples/exam.json";

export const ALL_DOMAINS: Domain[] = ["housing", "job", "parttime", "benefit", "training", "exam"];

export const SAMPLES: Record<Domain, Opportunity[]> = {
  housing: housing as Opportunity[],
  job: job as Opportunity[],
  parttime: parttime as Opportunity[], // 알바는 합법 공개 API가 없어 샘플만
  benefit: benefit as Opportunity[],
  training: training as Opportunity[],
  exam: exam as Opportunity[],
};

export const ADAPTERS: SourceAdapter[] = [lhNotice, myhome, jobalio, gov24, youthcenter, work24Training, qnet];

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; items: Opportunity[] }>();
const AI_ENRICH_LIMIT = 15;
const aiConditionCache = new Map<string, Condition[]>();

/** 테스트용 */
export function _clearCache() {
  cache.clear();
  aiConditionCache.clear();
}

async function runAdapter(a: SourceAdapter, now: Date): Promise<Opportunity[]> {
  if (!process.env[a.envKey]) return [];
  const hit = cache.get(a.id);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.items;
  try {
    const items = await a.fetch(now);
    cache.set(a.id, { at: now.getTime(), items });
    return items;
  } catch (e) {
    console.warn(`[sources] ${a.id} 실패, 샘플로 폴백:`, (e as Error).message);
    return [];
  }
}

/** 키가 있으면 실데이터 자격요건을 Claude로 다시 구조화(분야·지역 조건은 유지) */
async function enrichWithAi(items: Opportunity[]): Promise<Opportunity[]> {
  if (!aiEnabled()) return items;
  let budget = AI_ENRICH_LIMIT;
  return Promise.all(
    items.map(async (o) => {
      const raw = getEligibility(o);
      if (!raw) return o;
      let conds = aiConditionCache.get(o.id);
      if (!conds) {
        if (budget-- <= 0) return o;
        conds = await structureConditions(raw);
        aiConditionCache.set(o.id, conds);
      }
      const keep = o.conditions.filter((c) => c.attr === "interest" || (c.attr === "region" && c.rawText.startsWith("대상 지역")) || (c.attr === "age" && /^만 \d+세 (이상|이하)$/.test(c.rawText)));
      const add = conds
        .filter((c) => c.attr !== "interest" && !keep.some((k) => k.attr === c.attr))
        .map((c) => ({ ...c, aiGenerated: true }));
      return { ...o, conditions: [...keep, ...add] };
    }),
  );
}

/** 분야별 공고를 모은다. domains 생략 시 6개 분야 전체 */
export async function loadOpportunities(domains: Domain[] = ALL_DOMAINS, now: Date = new Date()): Promise<Opportunity[]> {
  const wanted = domains.filter((d) => ALL_DOMAINS.includes(d));
  const adapters = ADAPTERS.filter((a) => a.domains.some((d) => wanted.includes(d)));
  const [live, web] = await Promise.all([
    Promise.all(adapters.map((a) => runAdapter(a, now))).then((r) => r.flat()),
    searchWeb(wanted, now), // 선택 기능: 기본 OFF
  ]);
  const today = todayKst(now);

  const out: Opportunity[] = [];
  const seen = new Set<string>();
  for (const d of wanted) {
    const liveOpen = live.filter((o) => o.domain === d && isOpen(o, today));
    const picked = liveOpen.length ? await enrichWithAi(liveOpen) : SAMPLES[d].filter((o) => isOpen(o, today));
    for (const o of picked) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  for (const o of web) {
    if (seen.has(o.id) || out.some((x) => x.url === o.url)) continue; // 공식 API에 이미 있는 원문은 중복 제외
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

/** "housing,benefit" → Domain[] (알 수 없는 값은 버림). 비거나 모두 무효면 전체 */
export function parseDomains(param: string | null | undefined): Domain[] {
  if (!param) return ALL_DOMAINS;
  const list = param.split(",").map((s) => s.trim()).filter((s): s is Domain => (ALL_DOMAINS as string[]).includes(s));
  return list.length ? [...new Set(list)] : ALL_DOMAINS;
}
