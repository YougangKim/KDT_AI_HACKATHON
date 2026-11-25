// 가상 사용자 시나리오 테스트(배포 사이트, 실제 Chrome으로 끝까지 누른다). 공공 API로 모은 공고만 사용, 크롤링 없음.
// 실행: cd e2e && node persona-live.mjs [BASE_URL]   (가상 사용자: personas-8.json, PERSONAS_FILE로 변경)
// 결과: e2e/artifacts/persona-<시각>.json + 결과 화면 캡처
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "https://kdtaihackathon-web.vercel.app").replace(/\/$/, "");
const ART = fileURLToPath(new URL("./artifacts/", import.meta.url));
mkdirSync(ART, { recursive: true });
const PERSONAS = JSON.parse(readFileSync(new URL(process.env.PERSONAS_FILE ?? "./personas-8.json", import.meta.url), "utf8"));
const DOMAIN_LABEL = { housing: "청년 주택", benefit: "지원금", job: "채용", parttime: "알바", training: "국비", exam: "자격증" };
const REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (t) => t.replace(/\(\d+건\)$/, "").trim();
const zero = (t) => /\(0건\)$/.test(t);
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAV = /이전 질문|^$|고르고 다음|이상 선택|결과 보기|처음으로/;
const NONE = /해당 (분야 )?없음|상관없|모름|모르겠|전부 보여|둘 다 괜찮/;

function pick(p, q, opts) {
  const has = (re) => opts.find((o) => !zero(o) && re.test(clean(o)));
  if (opts.includes("예") && opts.includes("아니오")) {
    if (/수급자|차상위|장애/.test(q)) return p.welfare ? "예" : "아니오"; // 설정에 없는 복지 대상은 아니오
    const rs = REGIONS.filter((r) => q.includes(r));
    if (rs.length) return rs.includes(p.region) ? "예" : "아니오";
    const n = Number((q.match(/(\d+)\s*세/) || [])[1]);
    if (n) return (/이하|미만/.test(q) ? p.age <= n : p.age >= n) ? "예" : "아니오";
    if (/무주택|집이 없|주택을 소유/.test(q)) return p.homeless ? "예" : "아니오";
    if (/혼자|1인/.test(q)) return p.alone ? "예" : "아니오";
    if (/직장|재직/.test(q)) return p.employed ? "예" : "아니오";
    if (/학생|재학|휴학/.test(q)) return p.status === "학생" ? "예" : "아니오";
    if (/구직|미취업|실업/.test(q)) return p.employed ? "아니오" : "예";
    if (p.prefs.some((r) => new RegExp(r).test(q))) return "예";
  }
  const age = opts.find((o) => {
    let m;
    return ((m = o.match(/(\d+)세 이하/)) && p.age <= +m[1]) || ((m = o.match(/(\d+)\s*~\s*(\d+)세/)) && p.age >= +m[1] && p.age <= +m[2]) || ((m = o.match(/(\d+)세 이상/)) && p.age >= +m[1]);
  });
  if (age) return age;
  if (/학력/.test(q) && p.edu) { const o = opts.find((x) => x.includes(p.edu)); if (o) return o; }
  if (opts.includes(p.status)) return p.status;
  if (opts.includes("대학생") && opts.includes("비대학생")) return p.status === "학생" ? "대학생" : "비대학생";
  if (opts.includes(p.region)) return p.region;
  for (const r of p.prefs) { const o = has(new RegExp(r)); if (o) return o; }
  return opts.find((o) => NONE.test(o)) ?? opts.find((o) => !zero(o));
}

async function state(page) {
  const t = await page.locator("main").innerText().catch(() => "");
  const m = t.match(/(\d+)개 \/ (\d+)\n+(?:[−+-]\d+\n+)?([^\n]+)/);
  const q = m?.[3] && !/중…$|중\.\.\.$/.test(m[3]) ? m[3] : null; // "질문을 만드는 중…"은 질문이 아니다
  return { t, remain: m ? +m[1] : null, q };
}
const onPlay = (page) => new URL(page.url()).pathname.startsWith("/play");

async function play(page, p, log, max = 15) {
  const qs = [];
  for (let i = 0; i < max && onPlay(page); i++) {
    let s = await state(page);
    for (let w = 0; !s.q && w < 40 && onPlay(page); w++) { await sleep(500); s = await state(page); }
    if (!s.q) { if (onPlay(page)) log.deadEnds.push(s.t.slice(0, 200)); break; }
    const btns = page.locator("main button");
    const all = (await btns.allInnerTexts()).map((x) => x.trim());
    const opts = all.filter((x) => !NAV.test(x));
    const multi = /여러 개/.test(s.q) || all.some((x) => /고르고 다음|이상 선택/.test(x));
    const t0 = Date.now();
    let chose;
    if (multi) {
      const res = p.prefs.map((r) => new RegExp(r)); // 여러 개 고르기는 설정한 선호만(희망 키워드 wants는 평가용)
      const sel = opts.filter((o) => !zero(o) && !NONE.test(o) && res.some((re) => re.test(clean(o))));
      if (sel.length) {
        for (const o of sel) await btns.filter({ hasText: new RegExp(`^${esc(o)}$`) }).first().click();
        await sleep(300);
        await page.locator("main button", { hasText: /고르고 다음/ }).first().click();
        chose = sel.join("+");
      } else {
        chose = opts.find((o) => NONE.test(o)) ?? opts.find((o) => !zero(o));
        await btns.filter({ hasText: new RegExp(`^${esc(chose)}$`) }).first().click();
      }
    } else {
      chose = pick(p, s.q, opts);
      if (!chose) { log.deadEnds.push(`선택지 없음: ${s.q}`); break; }
      await btns.filter({ hasText: new RegExp(`^${esc(chose)}$`) }).first().click();
    }
    let n = s;
    for (let w = 0; w < 40; w++) { await sleep(300); n = await state(page); if (n.q !== s.q || !onPlay(page)) break; }
    await sleep(1200);
    n = await state(page);
    qs.push({ q: s.q, options: opts, multi, chose, remain: s.remain, nextRemain: n.remain, ms: Date.now() - t0 });
  }
  return qs;
}

const countsOf = (t) => ({ all: Number((t.match(/전체 (\d+)개/) || [])[1]) || null, ready: Number((t.match(/바로 신청 (\d+)개/) || [])[1]) || null });

async function runPersona(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR", ...(p.geo ? { geolocation: { latitude: p.geo[0], longitude: p.geo[1] }, permissions: ["geolocation"] } : {}) });
  const page = await ctx.newPage();
  const log = { id: p.id, name: p.name, deadEnds: [], errors: [] };
  page.on("console", (m) => m.type() === "error" && log.errors.push(m.text().slice(0, 160)));
  page.on("response", (r) => r.status() >= 400 && log.errors.push(`${r.status()} ${new URL(r.url()).pathname}`));
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "networkidle" });
  for (const d of p.domains) await page.locator("main button", { hasText: DOMAIN_LABEL[d] }).first().click();
  await page.locator("main button", { hasText: "시작하기" }).first().click();
  await page.waitForURL(/\/play/);
  await sleep(1500);
  if (p.geo) {
    await page.locator("main button", { hasText: "현재 위치 사용" }).click();
    await page.locator("main button", { hasText: p.distance }).first().click({ timeout: 15000 });
    await page.locator("main button", { hasText: "이 위치로 계속하기" }).click();
  } else await page.locator("main button", { hasText: "건너뛰기" }).click();
  await sleep(1500);
  log.questions = await play(page, p, log);
  await page.waitForURL(/\/result/, { timeout: 30000 }).catch(() => {});
  await sleep(3000);
  log.reachedResult = new URL(page.url()).pathname.startsWith("/result");
  log.taskSec = Math.round((Date.now() - t0) / 1000);
  const r = await page.locator("main").innerText().catch(() => "");
  log.resultHead = r.slice(0, 800);
  log.counts = countsOf(r);
  await page.screenshot({ path: `${ART}persona-${p.id}-result.png` });
  const show = page.locator("main button", { hasText: /^20개$/ }).first(); // 보고 싶은 수 20개로 늘려 상위 10개를 확보
  if (await show.count()) { await show.click().catch(() => {}); await sleep(1200); }
  const full = await page.locator("main").innerText().catch(() => "");
  const cards = full.split(/원문 ↗|원문 보기/).slice(0, -1);
  const re = new RegExp(p.wants);
  log.cards = cards.slice(0, 10).map((c) => c.trim().split("\n").filter(Boolean).slice(0, 8).join(" / ").slice(0, 300));
  log.wantsHit = { top3: cards.slice(0, 3).filter((c) => re.test(c)).length, top10: cards.slice(0, 10).filter((c) => re.test(c)).length, shown: Math.min(10, cards.length) };
  const narrow = page.locator("main a, main button", { hasText: "좁히기" }).first();
  log.narrow = { present: (await narrow.count()) > 0 };
  if (log.narrow.present) {
    await narrow.click();
    await sleep(4000);
    log.narrow.questions = await play(page, p, log, 5);
    const stop = page.locator("main button", { hasText: /결과 보기/ }).first();
    if (onPlay(page) && (await stop.count())) await stop.click();
    await page.waitForURL(/\/result/, { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    log.narrow.countsAfter = countsOf(await page.locator("main").innerText().catch(() => ""));
  }
  await ctx.close();
  return log;
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome", headless: true });
const runs = [];
for (const p of PERSONAS) {
  try { runs.push(await runPersona(browser, p)); } catch (e) { runs.push({ id: p.id, name: p.name, error: String(e).slice(0, 300) }); }
  const r = runs.at(-1);
  console.log(`${r.id} ${r.name} | 결과 ${r.reachedResult ?? false} | 질문 ${r.questions?.length ?? 0} | 전체 ${r.counts?.all} 바로신청 ${r.counts?.ready} | 희망 ${r.wantsHit ? `${r.wantsHit.top3}/3, ${r.wantsHit.top10}/${r.wantsHit.shown}` : "-"} | 좁히기 ${r.narrow?.questions?.length ?? 0}문항 → ${r.narrow?.countsAfter?.all ?? "-"} | ${r.taskSec ?? "-"}초 ${r.error ?? ""}`);
}
await browser.close();
const file = `${ART}persona-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ base: BASE, at: new Date().toISOString(), runs }, null, 2));
console.log("기록", file);
