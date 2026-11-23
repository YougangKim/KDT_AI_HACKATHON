import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3950";
const OUT = "../docs/intro/assets/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 37.5665, longitude: 126.978 }, permissions: ["geolocation"] });
const page = await ctx.newPage();
await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
const shot = (n) => page.screenshot({ path: OUT + n + ".png" });
const btnTexts = async () => (await page.locator("main button").allInnerTexts()).map((s) => s.trim());
await page.goto(BASE, { waitUntil: "networkidle" }); await sleep(1500); await shot("s_home");
console.log("home", (await btnTexts()).join("|"));
for (const d of ["주거", "채용"]) await page.locator("main button", { hasText: d }).first().click().catch(() => {});
await page.locator("main button", { hasText: /시작/ }).first().click();
await page.waitForURL(/\/play/); await sleep(4000);
let t = await btnTexts(); console.log("loc", t.join("|"));
await page.locator("main button").first().click(); await sleep(3000);
await page.locator("main button", { hasText: /^10\s*km$/ }).first().click().catch(() => {}); await sleep(1500);
await shot("s_q0");
t = await btnTexts(); console.log("loc2", t.join("|"));
const go = t.findIndex((x) => /(이 위치|다음|완료|시작|찾기|확인)/.test(x) && !/검색/.test(x));
if (go >= 0) await page.locator("main button").nth(go).click(); await sleep(3500);
for (let i = 0; i < 20 && new URL(page.url()).pathname.startsWith("/play"); i++) {
  t = await btnTexts();
  if (i === 1) { await shot("s_q2"); console.log("q", t.join("|")); }
  let idx = t.findIndex((x) => /^(예|모름|잘 모르겠어요|상관없어요)/.test(x));
  if (idx < 0) idx = 0;
  await page.locator("main button").nth(idx).click().catch(() => {}); await sleep(2500);
}
await page.waitForURL(/\/result/, { timeout: 30000 }).catch(() => {}); await sleep(6000);
await shot("s_result");
await page.evaluate(() => scrollBy(0, 650)); await sleep(1500); await shot("s_result2");
for (const [p, n] of [["/result/analysis", "s_analysis"], ["/settings", "s_settings"], ["/alerts", "s_alerts"]]) {
  await page.goto(BASE + p, { waitUntil: "networkidle" }).catch(() => {}); await sleep(3000); await shot(n);
}
await b.close(); console.log("done");
