// 로컬 공고 풀(.cache/pool-v1.json)의 미분류 공고에 Jev 분류 태그를 한 번에 붙인다(로컬 데모용).
// 실행: AI_EVAL=1 npx vitest run scripts/jev-backfill-pool.test.ts (env 없으면 건너뜀). 운영은 수집(cron)이 300건씩 보충한다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { it } from "vitest";
const path = ".cache/pool-v1.json";
const hasEnv = existsSync(".env.local") && existsSync(path) && process.env.AI_EVAL === "1";
if (hasEnv) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim(); }
it.skipIf(!hasEnv)("로컬 풀 Jev 태그 보충", async () => {
  const { attachTags } = await import("@/lib/sources/classify");
  const { allFacets } = await import("@/lib/server/facets");
  const facets = await allFacets();
  const snap = JSON.parse(readFileSync(path, "utf8"));
  const t0 = Date.now();
  const tagged: Record<string, Record<string, string>> = {};
  for (const [source, list] of Object.entries(snap.sources) as [string, import("@/lib/types").Opportunity[]][]) {
    const { items: out } = await attachTags(list, facets, { limit: 100000 });
    for (const o of out) if (o.tags) tagged[o.id] = o.tags;
    console.log(source, list.length, "tagged", out.filter((o) => o.tags).length, Math.round((Date.now() - t0) / 1000) + "s");
  }
  // 그 사이 서버가 풀을 다시 썼을 수 있으니 최신 파일에 태그만 합친다
  const latest = JSON.parse(readFileSync(path, "utf8"));
  for (const list of Object.values(latest.sources) as import("@/lib/types").Opportunity[][]) for (const o of list) if (tagged[o.id]) o.tags = { ...(o.tags ?? {}), ...tagged[o.id] };
  writeFileSync(path, JSON.stringify(latest));
  console.log("done", Object.keys(tagged).length, Math.round((Date.now() - t0) / 1000) + "s");
}, 1800000);
