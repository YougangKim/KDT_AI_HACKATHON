// 실데이터·실제 Gemini로 결과 화면 지연 측정: 결과 표시까지, 카드 요약(AI) 채워지기까지
// 실행: web에서 next start(실키) 후  node measure-summary.mjs [BASE] [회수]
import { chromium } from "playwright-core";
const BASE = process.argv[2] ?? "http://localhost:5300";
const RUNS = Number(process.argv[3] ?? 3);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: [/청년 주택/, /채용/, /지원금/][i % 3] }).click();
  await page.getByRole("button", { name: /분야로 시작하기/ }).click();
  const skip = page.getByRole("button", { name: "건너뛰기", exact: true });
  await skip.waitFor({ timeout: 30000 });
  await skip.click();
  // 첫 질문에서 바로 결과로(질문 응답 시간은 사용자 몫이라 제외)
  for (let k = 0; k < 3; k++) {
    const unknown = page.getByRole("button", { name: /^(모르겠어요|상관없어요|전부 보여 주세요|둘 다 괜찮아요)$/ }).first();
    await unknown.waitFor({ timeout: 20000 });
    await unknown.click();
    await page.waitForTimeout(300);
  }
  const stop = page.getByRole("button", { name: /바로 결과 보기/ });
  const t0 = Date.now();
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await page.waitForURL("**/result", { timeout: 30000 });
  await page.getByText(/^전체 \d+개/).waitFor({ timeout: 30000 });
  const tResult = Date.now() - t0;
  // AI 요약이 채워지기를 최대 10초 기다린다
  const filled = await page.waitForFunction(() => document.querySelectorAll("[data-summary-ms]").length > 0, null, { timeout: 10000 }).then(() => true).catch(() => false);
  const ms = await page.$$eval("[data-summary-ms]", (els) => els.map((e) => Number(e.getAttribute("data-summary-ms"))));
  const ai = await page.getByText("AI 요약").count();
  rows.push({ run: i + 1, resultMs: tResult, summaryFilled: filled, summaryMs: ms, aiCards: ai });
  await ctx.close();
}
console.log(JSON.stringify(rows, null, 1));
await browser.close();
