// AI 정확도 평가용 데이터 생성(실행 후 삭제하는 임시 스크립트 아님: 재실행 가능하도록 남김, vitest 기본 실행에서는 제외하지 않으므로 env 없으면 건너뜀)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { it } from "vitest";
const envPath = ".env.local";
const hasEnv = existsSync(envPath) && process.env.AI_EVAL === "1";
if (hasEnv) for (const l of readFileSync(envPath, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim(); }
it.skipIf(!hasEnv)("AI 해석 평가 데이터", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { gov24 } = await import("@/lib/sources/gov24");
  const { jobalio } = await import("@/lib/sources/jobalio");
  const { getEligibility } = await import("@/lib/sources/util");
  const ai = await import("@/lib/ai");
  const { plausibleAiCondition } = await import("@/lib/sources");
  const now = new Date();
  const items = [...(await gov24.fetch(now)).slice(0, 14), ...(await jobalio.fetch(now)).slice(0, 8)];
  const rows = [];
  for (const o of items) {
    const raw = getEligibility(o);
    if (!raw || rows.length >= 20) continue;
    const fmt = (cs: { attr: string; op: string; value: unknown }[]) => cs.map((c) => `${c.attr} ${c.op} ${JSON.stringify(c.value)}`);
    const aiConds = await ai.structureConditions(raw);
    const rule = ai.structureConditionsRules(raw);
    const aiOk = aiConds.filter(plausibleAiCondition);
    const hybrid = [...rule, ...aiOk.filter((c) => !rule.some((r) => r.attr === c.attr))]; // 앱 실제 방식: 규칙 우선 + AI 보완
    rows.push({ id: rows.length + 1, 출처: o.source, 제목: o.title, 원문: raw.slice(0, 600), AI: fmt(aiOk), 규칙: fmt(rule), 합성: fmt(hybrid) });
    await new Promise((r) => setTimeout(r, 1500)); // 무료 등급 한도
  }
  writeFileSync("../plan/ai_eval_data.json", JSON.stringify(rows, null, 2));
  console.log("rows", rows.length);
}, 300000);
