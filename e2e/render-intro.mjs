import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
const [html, pdf, pngPrefix] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: pdf, width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
const n = await page.locator("section.slide").count();
for (let i = 0; i < n; i++) await page.locator("section.slide").nth(i).screenshot({ path: `${pngPrefix}${String(i + 1).padStart(2, "0")}.png` });
// 넘침 검사: 슬라이드 밖으로 나간 요소
const over = await page.evaluate(() => [...document.querySelectorAll("section.slide")].map((s, i) => { const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll("*")].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.bottom > r.bottom + 1); }).length; return bad ? `${i + 1}:${bad}` : null; }).filter(Boolean));
console.log("slides", n, "overflow", over.join(" ") || "none");
await b.close();
