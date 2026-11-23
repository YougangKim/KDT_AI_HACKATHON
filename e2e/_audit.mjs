import { chromium } from "playwright-core";
const B = "http://localhost:5300", O = "D:/KDT_AI_HACKATHON/docs/screenshots/audit/";
for (let i = 0; i < 40; i++) { if (await fetch(B).then(r => r.ok).catch(() => false)) break; await new Promise(r => setTimeout(r, 500)); }
const res = {};
const b = await chromium.launch({ channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 37.5665, longitude: 126.978 }, permissions: ["geolocation"] });
const p = await ctx.newPage();
await p.goto(B + "/"); await p.waitForTimeout(300); await p.screenshot({ path: O + "01_splash.png" });
await p.waitForTimeout(1300);
const body = async () => (await p.locator("body").innerText());
res.brand = /My News/.test(await body()) && /나만의 소식통/.test(await body());
await p.screenshot({ path: O + "02_home.png" });
for (const n of [/청년 주택/, /지원금/, /채용/]) await p.getByRole("button", { name: n }).first().click();
await p.getByRole("button", { name: /시작하기/ }).click();
await p.getByRole("heading", { name: /내 위치와 원하는 거리/ }).waitFor({ timeout: 20000 });
// 주소 검색(카카오)
const search = p.getByPlaceholder(/주소나 장소 검색/);
let kakao = false;
if (await search.isVisible().catch(() => false)) { await search.fill("서울시청"); await search.press("Enter"); await p.waitForTimeout(2500); kakao = /검색 위치: 서울특별시청/.test(await body()); }
res.addressSearch = kakao;
await p.getByRole("group", { name: "거리 반경" }).getByRole("button", { name: "10km", exact: true }).click();
res.radiusGroup = true;
await p.screenshot({ path: O + "03_location.png" });
await p.getByRole("button", { name: /이 위치로 계속하기/ }).click();
const asked = []; const buttons = {}; let incomeLabels = null; let fieldLabels = null;
for (let i = 0; i < 30; i++) {
  if (/\/result/.test(p.url())) break;
  const q = p.getByTestId("question"); if (!(await q.isVisible().catch(() => false))) { await p.waitForTimeout(800); continue; }
  const t = (await q.innerText()).trim(); if (asked[asked.length - 1] === t) { await p.waitForTimeout(500); continue; } asked.push(t);
  const group = p.getByRole("group").first();
  if (await group.isVisible().catch(() => false)) {
    const name = await group.getAttribute("aria-label");
    const labels = (await group.getByRole("button").allTextContents()).map(s => s.trim());
    buttons[name] = labels.slice(-3);
    if (name === "소득 구간") { incomeLabels = labels; await p.screenshot({ path: O + "05_income.png" }); }
    if (/분야/.test(name)) { fieldLabels = labels; await p.screenshot({ path: O + "06_field.png", fullPage: true }); }
    const multiNext = group.getByRole("button", { name: /고르고 다음/ });
    const first = group.getByRole("button").first();
    await first.click();
    if (await multiNext.isVisible().catch(() => false)) await multiNext.click();
  } else {
    if (i === 3) await p.screenshot({ path: O + "04_yesno.png" });
    const t2 = t; await p.getByRole("button", { name: /무주택|세 이하/.test(t2) ? "예" : "아니오", exact: true }).click();
  }
  await p.waitForTimeout(1500);
}
res.asked = asked; res.buttons = buttons; res.incomeLabels = incomeLabels; res.fieldLabels = fieldLabels;
await p.waitForURL("**/result", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(3000);
const rb = await body();
res.whyRemoved = !/왜 맞는지/.test(rb);
res.tabs = await p.getByRole("button").filter({ hasText: /^(전체|주거|지원금|채용)/ }).allTextContents();
const cards = p.locator("article");
const top = []; for (let i = 0; i < Math.min(3, await cards.count()); i++) top.push(((await cards.nth(i).innerText()).split("\n").slice(0, 2).join(" ")));
res.top3 = top;
res.legend = await p.getByRole("list", { name: "지도 분야 범례" }).innerText().catch(() => "");
res.narrow = /추가 질문으로 더 좁히기|더 좁힐 질문이 없어요/.test(rb);
await p.screenshot({ path: O + "07_result.png" });
const mapBtn = p.getByRole("button", { name: "지도에서 보기" }).first();
if (await mapBtn.isVisible().catch(() => false)) { await mapBtn.click(); await p.locator(".leaflet-popup-content").waitFor({ timeout: 5000 }).catch(() => {}); res.popup = (await p.locator(".leaflet-popup-content").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 150); await p.screenshot({ path: O + "08_popup.png" }); }
await p.goto(B + "/result/analysis"); await p.waitForTimeout(2000); await p.screenshot({ path: O + "09_analysis.png", fullPage: true });
await p.goto(B + "/settings"); await p.waitForTimeout(1500); res.settings = /설정 저장/.test(await body()); await p.screenshot({ path: O + "10_settings.png", fullPage: true });
console.log(JSON.stringify(res, null, 1));
await b.close();
