import { chromium } from "playwright-core";
const BASE = "http://localhost:3950", OUT = "../docs/intro/assets/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const [p, n] of (process.argv[2] ? JSON.parse(process.argv[2]) : [])) {
  await page.goto(BASE + p, { waitUntil: "networkidle" }).catch(() => {}); await sleep(3000);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (n.endsWith("@")) { await page.evaluate(() => scrollBy(0, 650)); await sleep(800); }
  await page.screenshot({ path: OUT + n.replace("@", "") + ".png" }); console.log(n, (await page.innerText("body")).slice(0, 80).replace(/\s+/g, " "));
}
await b.close();
