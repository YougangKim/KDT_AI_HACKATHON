// Jev 공고 분류 실측: 로컬 공고 풀(.cache/pool-v1.json)에서 분야별 표본을 뽑아 Jev 태그와 기존 키워드 판별을 비교한다.
// 실행: AI_EVAL=1 npx vitest run scripts/jev-classify-eval.test.ts (env 없으면 건너뜀). 결과: ../plan/jev_classify_eval.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { it } from "vitest";
const hasEnv = existsSync(".env.local") && existsSync(".cache/pool-v1.json") && process.env.AI_EVAL === "1";
if (hasEnv) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim(); }
it.skipIf(!hasEnv)("Jev 분류 실측", async () => {
  const { attachTags } = await import("@/lib/sources/classify");
  const { inferJobConditions } = await import("@/lib/sources");
  const snap = JSON.parse(readFileSync(".cache/pool-v1.json", "utf8"));
  const all = (Object.values(snap.sources) as never[][]).flat() as import("@/lib/types").Opportunity[];
  const pick = (d: string, n: number) => { const l = all.filter((o) => o.domain === d); return Array.from({ length: Math.min(n, l.length) }, (_, i) => l[Math.floor(i * l.length / n)]); };
  const sample = [...pick("job", 60), ...pick("parttime", 20), ...pick("benefit", 30), ...pick("housing", 10), ...pick("training", 10)].map((o) => ({ ...o, tags: undefined }));
  const t0 = Date.now();
  const { RULE_FACETS } = await import("@/lib/ai/refinement-rules");
  const { items: tagged } = await attachTags(sample, RULE_FACETS, { limit: 1000 });
  const ms = Date.now() - t0;
  const fieldOf = (o: import("@/lib/types").Opportunity) => inferJobConditions(o).conditions.find((c) => c.attr === "field")?.value;
  const rows = tagged.map((o) => ({ domain: o.domain, title: o.title, org: o.org, summary: o.summary.slice(0, 120), tags: o.tags ?? null,
    keywordField: o.domain === "job" || o.domain === "parttime" ? fieldOf({ ...o, tags: undefined }) : undefined }));
  writeFileSync("../plan/jev_classify_eval.json", JSON.stringify({ ms, n: rows.length, rows }, null, 2));
  console.log("n", rows.length, "ms", ms, "tagged", rows.filter((r) => r.tags).length);
}, 600000);
