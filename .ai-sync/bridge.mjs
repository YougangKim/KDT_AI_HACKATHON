import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const agent = process.argv[2];
if (!new Set(["claude", "codex"]).has(agent)) process.exit(0);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(root, ".ai-sync", "state");
const statePath = path.join(stateDir, `${agent}-latest.json`);
const peer = agent === "claude" ? "codex" : "claude";
const peerPath = path.join(stateDir, `${peer}-latest.json`);
const handoffPath = path.join(root, "AI_HANDOFF.md");

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  process.stdout.write("{}");
  process.exit(0);
}

fs.mkdirSync(stateDir, { recursive: true });

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function clean(value, limit) {
  return String(value || "")
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED_API_KEY]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "$1[REDACTED]")
    .slice(-limit);
}

function save(update) {
  const current = readJson(statePath);
  fs.writeFileSync(
    statePath,
    `${JSON.stringify({ ...current, ...update, agent, sessionId: input.session_id || current.sessionId, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

const event = input.hook_event_name;
if (event === "UserPromptSubmit") {
  save({ lastUserPrompt: clean(input.prompt, 4000) });
}
if (event === "Stop") {
  save({ lastAssistantMessage: clean(input.last_assistant_message, 6000) });
  process.stdout.write("{}");
  process.exit(0);
}

if (event === "SessionStart" || event === "UserPromptSubmit") {
  const peerState = readJson(peerPath);
  const handoff = fs.existsSync(handoffPath) ? clean(fs.readFileSync(handoffPath, "utf8"), 6000) : "";
  const peerContext = peerState.updatedAt
    ? [
        `상대 에이전트: ${peer}`,
        `마지막 갱신: ${peerState.updatedAt}`,
        peerState.lastUserPrompt ? `최근 사용자 요청:\n${clean(peerState.lastUserPrompt, 3000)}` : "",
        peerState.lastAssistantMessage ? `최근 응답:\n${clean(peerState.lastAssistantMessage, 5000)}` : "",
      ].filter(Boolean).join("\n\n")
    : "상대 에이전트의 공유 상태가 아직 없습니다.";
  const additionalContext = [
    "[Claude–Codex 로컬 브리지] 아래 내용은 공동 작업의 참고 상태다. 최신 사용자 요청과 현재 파일 상태가 우선이며, 상대 변경을 임의로 되돌리지 않는다.",
    handoff ? `\n공동 상태판:\n${handoff}` : "",
    `\n상대 대화 상태:\n${peerContext}`,
  ].join("\n");
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext,
    },
  }));
  process.exit(0);
}

process.stdout.write("{}");
