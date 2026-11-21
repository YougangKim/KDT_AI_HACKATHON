// 상대 에이전트에게 작업 1건을 위임하고 결과를 파일로 받는다.
// 사용: node .ai-sync/delegate.mjs <codex|claude> "요청 내용" [--write] [--review] [--no-fallback]
// --review: 상대가 만든 결과물을 냉정하게 평가하도록 .ai-sync/prompts/strict-review.md를 앞에 붙인다(교차 평가)
// 기록: .ai-sync/tasks/<시각>-<대상>/request.md, result.md (result.md가 없으면 진행 중/실패)
//
// 사용량 한도 대응:
//  1) 대상 에이전트가 한도에 걸리면 다른 에이전트로 넘겨 실행한다(폴백).
//     단 --review(교차 평가)는 만든 쪽이 스스로 평가하게 되므로 폴백하지 않는다.
//  2) 둘 다 한도면 .ai-sync/queue/ 에 작업을 저장하고, 리셋 시각 +3분에 Windows 작업 스케줄러가
//     .ai-sync/resume.mjs 를 실행해 자동 재개한다(30분 주기 작업은 register-resume-task.ps1로 한 번 등록). 종료 코드 75 = 대기열에 저장됨.
// 테스트: 환경변수 AI_SYNC_FAKE_LIMIT=codex,claude 로 한도 오류를 흉내 낸다. 
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [target, ...rest] = process.argv.slice(2);
const readOnly = !rest.includes("--write"); // 기본 읽기 전용(Windows에서 codex 쓰기 샌드박스 미설정)
const review = rest.includes("--review");
const noFallback = rest.includes("--no-fallback");
const flags = rest.filter((a) => a.startsWith("--"));
const prompt = rest.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!["codex", "claude"].includes(target) || !prompt) {
  console.error('사용: node .ai-sync/delegate.mjs <codex|claude> "요청" [--write] [--review] [--no-fallback]');
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const queueDir = path.join(root, ".ai-sync", "queue");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const dir = path.join(root, ".ai-sync", "tasks", `${stamp}-${target}`);
fs.mkdirSync(dir, { recursive: true });
const resultPath = path.join(dir, "result.md");

const reviewGuide = review
  ? fs.readFileSync(path.join(root, ".ai-sync", "prompts", "strict-review.md"), "utf8") + "\n---\n"
  : "";
const fullPrompt = [
  reviewGuide + prompt,
  "",
  "---",
  "이 요청은 다른 AI 에이전트가 위임한 작업이다. AGENTS.md/CLAUDE.md 규칙을 따르고,",
  "git commit/push는 하지 말며, 최종 답변은 결과 요약만 한국어로 간결하게 작성한다.",
].join("\n");
fs.writeFileSync(path.join(dir, "request.md"), `# 요청 (${target}${review ? ", 교차 평가" : ""}, ${new Date().toISOString()})\n\n${prompt}\n`, "utf8");

const LIMIT_RE = /usage limit|rate limit|limit reached|hit your .*limit|quota|credit balance is too low|429/i;

/** "try again at 5:34 AM", "resets 5pm", "reset at 17:00" → 다음 해당 시각. 못 읽으면 1시간 뒤 */
export function parseResetAt(text, now = new Date()) {
  const m =
    text.match(/(?:try again at|resets?(?: at)?|reset at)\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?/) ?? null;
  if (!m) return new Date(now.getTime() + 60 * 60 * 1000);
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const t = new Date(now);
  t.setHours(h, min, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

function runAgent(agent) {
  const fake = (process.env.AI_SYNC_FAKE_LIMIT ?? "").split(",").includes(agent);
  if (fake) {
    const out = `ERROR: You've hit your usage limit. try again at ${new Date(Date.now() + 2 * 60 * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`;
    return { ok: false, limited: true, log: out, resetAt: parseResetAt(out) };
  }
  const out = path.join(dir, `result-${agent}.md`);
  const cmd = agent === "codex"
    ? `codex exec -C "${root}" -s ${readOnly ? "read-only" : "workspace-write"} --skip-git-repo-check -o "${out}" -`
    : `claude -p --permission-mode ${readOnly ? "plan" : "acceptEdits"}`;
  const run = spawnSync(cmd, { cwd: root, input: fullPrompt, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const log = `${run.stdout || ""}\n${run.stderr || ""}\n${run.error || ""}`;
  if (agent === "claude" && run.status === 0) fs.writeFileSync(out, run.stdout, "utf8");
  const text = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (run.status === 0 && text.trim()) return { ok: true, text };
  const limited = LIMIT_RE.test(log);
  return { ok: false, limited, log, resetAt: limited ? parseResetAt(log) : null };
}

function schedule(at) {
  // 작업 스케줄러는 사용자가 한 번만 등록한다(.ai-sync/register-resume-task.ps1, 30분 주기). 여기서는 PC 설정을 바꾸지 않는다.
  return `리셋 ${at.toLocaleString("ko-KR")} 이후 AI-Sync-Resume(30분 주기)가 자동 재개. 미등록이면 node .ai-sync/resume.mjs 수동 실행`;
}

const order = noFallback || review ? [target] : [target, target === "codex" ? "claude" : "codex"];
const notes = [];
let latestReset = null;
for (const agent of order) {
  const r = runAgent(agent);
  if (r.ok) {
    if (agent !== target) notes.push(`${target} 한도 → ${agent}로 대신 실행`);
    fs.writeFileSync(resultPath, (notes.length ? `> ${notes.join(" / ")}\n\n` : "") + r.text, "utf8");
    console.log(`결과: ${resultPath}\n`);
    console.log(fs.readFileSync(resultPath, "utf8"));
    process.exit(0);
  }
  fs.writeFileSync(path.join(dir, `error-${agent}.log`), r.log ?? "", "utf8");
  if (!r.limited) {
    console.error(`실패(${agent}, 한도 아님). 로그: ${path.join(dir, `error-${agent}.log`)}`);
    process.exit(1);
  }
  notes.push(`${agent} 한도(리셋 ${r.resetAt.toLocaleString("ko-KR")})`);
  if (!latestReset || r.resetAt < latestReset) latestReset = r.resetAt; // 먼저 풀리는 쪽 시각에 재시도
}

// 모두 한도 → 대기열에 저장하고 리셋 시각에 자동 재개 예약
fs.mkdirSync(queueDir, { recursive: true });
const item = { target, prompt, flags, resetAt: latestReset.toISOString(), queuedAt: new Date().toISOString(), taskDir: dir, notes };
const qPath = path.join(queueDir, `${stamp}-${target}-${Math.random().toString(36).slice(2, 6)}.json`);
fs.writeFileSync(qPath, JSON.stringify(item, null, 2), "utf8");
const sched = schedule(latestReset);
console.error(`모든 에이전트 한도: ${notes.join(" / ")}\n대기열 저장: ${qPath}\n자동 재개: ${sched}`);
process.exit(75);
