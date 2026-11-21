// 대기열(.ai-sync/queue/*.json)에 저장된 위임 작업을 리셋 시각이 지난 것부터 다시 실행한다.
// Windows 작업 스케줄러(AI-Sync-Resume)가 한도 리셋 +3분에 자동 실행. 수동 실행도 가능: node .ai-sync/resume.mjs
// 성공하면 대기열에서 지우고, 또 한도면 delegate.mjs가 새 대기 항목·새 예약을 만든다.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const queueDir = path.join(root, ".ai-sync", "queue");
const logPath = path.join(queueDir, "resume.log");
const log = (s) => fs.appendFileSync(logPath, `[${new Date().toLocaleString("ko-KR")}] ${s}\n`, "utf8");

if (!fs.existsSync(queueDir)) process.exit(0);
const now = Date.now();
const items = fs
  .readdirSync(queueDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ file: path.join(queueDir, f), ...JSON.parse(fs.readFileSync(path.join(queueDir, f), "utf8")) }));

for (const it of items) {
  if (new Date(it.resetAt).getTime() > now + 60_000) {
    log(`대기 유지: ${path.basename(it.file)} (리셋 ${it.resetAt})`);
    continue;
  }
  log(`재실행: ${path.basename(it.file)} → ${it.target}`);
  const r = spawnSync(process.execPath, [path.join(root, ".ai-sync", "delegate.mjs"), it.target, it.prompt, ...(it.flags ?? [])], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(it.file); // 성공·재대기 모두 원래 항목은 정리(재대기는 delegate가 새 항목을 만든다)
  log(r.status === 0 ? `완료: ${(r.stdout.match(/결과: (.+)/) ?? [])[1] ?? ""}` : r.status === 75 ? "다시 한도 → 새로 대기열 등록" : `실패(exit ${r.status})`);
}
