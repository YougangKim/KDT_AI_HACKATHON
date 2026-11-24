// Jev 대상 판정 관찰 측정(1단계): 자격요건 원문이 있는 실제 공고 표본에서
//  - Jev 대상 판정과 최종 조건(규칙+LLM)의 일치율
//  - Jev로 LLM 구조화를 대신했다면 줄었을 LLM 호출 수와, 그때 빠졌을 조건 수
//  - 근거 구절 대조로 "확인 필요"로 내려가는 AI 조건 수
// 를 계산한다. 최종 조건은 정답이 아니라 현재 동작 기준이다(정답셋 아님).
// 실행: AI_EVAL=1 npx vitest run scripts/jev-target-observe.test.ts  → ../plan/jev_target_observe.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { it } from "vitest";
const hasEnv = existsSync(".env.local") && process.env.AI_EVAL === "1";
if (hasEnv) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim(); }

const YES = 0.8, NO = 0.2, PER_SOURCE = 34;

it.skipIf(!hasEnv)("Jev 대상 판정 관찰 측정", async () => {
  const { youthcenter } = await import("@/lib/sources/youthcenter");
  const { gov24 } = await import("@/lib/sources/gov24");
  const { jobalio } = await import("@/lib/sources/jobalio");
  const { getEligibility, withEligibility } = await import("@/lib/sources/util");
  const { addTargetConditions } = await import("@/lib/sources/targets");
  const { applyAi } = await import("@/lib/sources");
  const { structureConditions, structureConditionsRules } = await import("@/lib/ai");
  const { observeTargets, presentKeys, OBSERVED_KEYS } = await import("@/lib/ai/target-judge");
  const now = new Date();

  // 공고 DB(로컬 풀)에 원문이 저장돼 있으면 그걸 쓰고(외부 API 호출 없음), 없을 때만 출처 API를 직접 부른다
  const snap = existsSync(".cache/pool-v1.json") ? JSON.parse(readFileSync(".cache/pool-v1.json", "utf8")) as { sources: Record<string, import("@/lib/types").Opportunity[]> } : null;
  const sample: { id: string; title: string; source: string; raw: string; o: import("@/lib/types").Opportunity }[] = [];
  for (const a of [youthcenter, gov24, jobalio]) {
    const stored = (snap?.sources[a.id] ?? []).filter((o) => (getEligibility(o) ?? "").length > 20);
    const items = stored.length ? stored : (await a.fetch(now).catch(() => [])).filter((o) => (getEligibility(o) ?? "").length > 20);
    const step = Math.max(1, Math.floor(items.length / PER_SOURCE));
    for (let i = 0; i < items.length && sample.filter((s) => s.source === a.id).length < PER_SOURCE; i += step)
      sample.push({ id: items[i].id, title: items[i].title, source: a.id, raw: getEligibility(items[i])!, o: items[i] });
  }

  const per: Record<string, { tp: number; fp: number; fn: number; tn: number; unsure: number }> = Object.fromEntries(OBSERVED_KEYS.map((k) => [k, { tp: 0, fp: 0, fn: 0, tn: 0, unsure: 0 }]));
  let llmNeeded = 0, wouldSkip = 0, jevFail = 0, lowered = 0, loweredItems = 0;
  const lostByAttr: Record<string, number> = {};
  const rows = [];
  for (const s of sample) {
    const rules = structureConditionsRules(s.raw);
    const ra = new Set(rules.map((c) => c.attr));
    const needs = !(rules.length >= 3 || (ra.has("age") && ra.size >= 2));
    const final = await structureConditions(s.raw);
    const jev = await observeTargets(s.raw);
    // 실제 수집 경로와 같은 순서: 대상 조건 보충 → AI 조건 적용(근거 검사·근거 대조 포함)
    const base = withEligibility(addTargetConditions(s.o, s.raw), s.raw);
    const effective = applyAi(base, final).conditions;
    const aiAdded = effective.filter((c) => c.aiGenerated);
    // 근거 대조 효과: 붙은 AI 조건 중 원래 high였는데 low로 내려간 수
    const nowLow = aiAdded.filter((c) => c.confidence === "low" && final.some((f) => f.attr === c.attr && f.rawText === c.rawText && f.confidence === "high")).length;
    lowered += nowLow; if (nowLow) loweredItems++;
    if (needs) llmNeeded++;
    if (!jev) { jevFail++; rows.push({ id: s.id, title: s.title, needs, jev: null }); continue; }
    const have = presentKeys(effective);
    for (const k of OBSERVED_KEYS) {
      const p = jev[k]; const truth = have.has(k);
      if (p === undefined || (p > NO && p < YES)) { per[k].unsure++; continue; }
      const yes = p >= YES;
      per[k][yes && truth ? "tp" : yes ? "fp" : truth ? "fn" : "tn"]++;
    }
    // 가설 게이트: LLM이 필요한 공고 중, Jev가 "규칙이 못 뽑은 숫자 조건은 없다"고 확신하면 LLM 생략
    if (needs) {
      const numericMissing = (jev.hasAge > NO && !ra.has("age")) || (jev.hasIncome > NO && !ra.has("incomePct"));
      if (!numericMissing) {
        wouldSkip++;
        // 생략했을 때 빠질 조건: 실제로 붙은 AI 조건 중 Jev 대상 키로도 못 잡는 것
        const jevYes = new Set(OBSERVED_KEYS.filter((k) => jev[k] >= YES));
        for (const c of aiAdded) {
          const ks = [...presentKeys([c])];
          if (!ks.some((k) => jevYes.has(k))) lostByAttr[c.attr] = (lostByAttr[c.attr] ?? 0) + 1;
        }
      }
    }
    rows.push({ id: s.id, title: s.title, needs, final: [...have], jev });
  }
  const acc = Object.fromEntries(Object.entries(per).map(([k, v]) => {
    const n = v.tp + v.fp + v.fn + v.tn;
    return [k, { ...v, agree: n ? +((v.tp + v.tn) / n).toFixed(2) : null }];
  }));
  const summary = { n: sample.length, bySource: Object.fromEntries(["youthcenter", "gov24", "jobalio"].map((id) => [id, sample.filter((s) => s.source === id).length])), jevFail, llmNeeded, wouldSkip, lostByAttr, evidenceLowered: { conditions: lowered, items: loweredItems }, perKey: acc };
  writeFileSync("../plan/jev_target_observe.json", JSON.stringify({ at: now.toISOString(), thresholds: { YES, NO }, summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}, 900000);
