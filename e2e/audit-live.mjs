// 배포 사이트 사용성 검수(자동 항목). 절차·기준: docs/검수_절차.md
// 실행: cd e2e && node audit-live.mjs [BASE_URL]   (기본: 운영 주소)
// 결과: e2e/artifacts/audit-<시각>.json, 콘솔 요약. 실제 Chrome으로 화면을 끝까지 누른다(서버를 띄우지 않음).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? process.env.AUDIT_BASE ?? "https://kdtaihackathon-web.vercel.app").replace(/\/$/, "");
const ART = fileURLToPath(new URL("./artifacts/", import.meta.url));
mkdirSync(ART, { recursive: true });

const REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const DOMAIN_KW = {
  housing: /주거|주택|임대|집/,
  job: /취업|채용|일자리|인턴/,
  benefit: /지원금|혜택|정책/,
  parttime: /알바/,
  training: /국비|훈련/,
  exam: /자격증/,
};
const DOMAIN_LABEL = { housing: "청년 주택", benefit: "지원금", job: "채용", parttime: "알바", training: "국비", exam: "자격증" };

const PERSONAS = [
  { id: "P1", name: "서울 상경 취준생", region: "서울", age: 25, homeless: true, alone: true, employed: false, domains: ["housing", "job"] },
  { id: "P2", name: "부산 알바생", region: "부산", age: 23, homeless: true, alone: false, employed: false, domains: ["benefit", "housing"] },
  { id: "P3", name: "경기 사회초년생(분야 미선택)", region: "경기", age: 28, homeless: false, alone: true, employed: true, domains: [] },
];

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const regionsIn = (s) => REGIONS.filter((r) => s.includes(r));
const kind = (q) =>
  regionsIn(q).length ? "region" : /세|나이/.test(q) ? "age" : /무주택|집이 없|주택을 소유/.test(q) ? "homeless"
  : /소득|중위/.test(q) ? "income" : /혼자|1인/.test(q) ? "alone" : /직장|재직|일하|학생|구직/.test(q) ? "employment"
  : Object.keys(DOMAIN_KW).find((d) => DOMAIN_KW[d].test(q)) ? "domain" : "other";

function answer(p, q, options) {
  // 선택형 질문(나이·취업 상태·학력·여러 개 고르기)
  const age = options.find((o) => { let m; return ((m = o.match(/^(\d+)세 이하$/)) && p.age <= +m[1]) || ((m = o.match(/^(\d+)~(\d+)세$/)) && p.age >= +m[1] && p.age <= +m[2]) || ((m = o.match(/^(\d+)세 이상$/)) && p.age >= +m[1]); });
  if (age && /나이/.test(q)) return age;
  if (options.includes("직장인") && options.includes("구직 중")) return p.employed ? "직장인" : "구직 중";
  if (options.includes("대졸(4년제)")) return "대졸(4년제)";
  for (const skip of ["상관없어요", "전부 보여 주세요", "둘 다 괜찮아요"]) if (options.includes(skip)) return skip;
  if (options.includes(p.region)) return p.region; // 지역 일괄 선택 버튼
  if (options.some((o) => REGIONS.includes(o))) return options.find((o) => /목록에 없/.test(o)) ?? "모르겠어요";
  const k = kind(q);
  if (k === "region") return regionsIn(q).includes(p.region) ? "예" : "아니오";
  if (k === "age") { const n = Number((q.match(/(\d+)\s*세/) || [])[1]); return n ? (/이하|미만/.test(q) ? (p.age <= n ? "예" : "아니오") : p.age >= n ? "예" : "아니오") : "예"; }
  if (k === "homeless") return p.homeless ? "예" : "아니오";
  if (k === "alone") return p.alone ? "예" : "아니오";
  if (k === "employment") return /직장|재직/.test(q) ? (p.employed ? "예" : "아니오") : p.employed ? "아니오" : "예";
  if (k === "domain") { const d = Object.keys(DOMAIN_KW).find((x) => DOMAIN_KW[x].test(q)); return p.domains.length === 0 ? "모르겠어요" : p.domains.includes(d) ? "예" : "아니오"; }
  return "모르겠어요";
}

const mainText = (page) => page.locator("main").innerText().catch(() => "");
async function waitChange(page, prev, ms = 12000) {
  for (let t = 0; t < ms; t += 250) { await sleep(250); const now = await mainText(page); if (now && now !== prev) return now; }
  return mainText(page);
}

async function play(page, p, log) {
  const qs = [];
  for (let i = 0; i < 15 && new URL(page.url()).pathname.startsWith("/play"); i++) {
    const t = await mainText(page);
    if (/조회 가능한 공고 없음|오류/.test(t)) { log.deadEnds.push({ where: page.url(), text: t.slice(0, 120) }); break; }
    const q = (t.match(/질문 \d+[^\n]*\n+([^\n]+)/) || [])[1];
    if (!q) { await sleep(500); continue; }
    const hint = t.match(/예면 (\d+)개, 아니오면 (\d+)개/);
    const remain = Number((t.match(/(\d+)개 \/ \d+/) || [])[1]);
    const btns = page.locator("main button");
    const options = (await btns.allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    const choose = answer(p, q, options);
    const target = btns.filter({ hasText: new RegExp(`^${escapeRe(choose)}$`) }).first();
    if (!(await target.count())) { log.deadEnds.push({ where: "질문", text: `선택지 없음: ${choose} / ${options.join(",")}` }); break; }
    const t0 = Date.now();
    await target.click();
    await waitChange(page, t);
    await sleep(1500); // 남은 후보 숫자 애니메이션이 끝난 뒤 읽는다
    const next = await mainText(page);
    const nextRemain = Number((next.match(/(\d+)개 \/ \d+/) || [])[1]);
    qs.push({ q, kind: kind(q), options: options.length, choose, remain, hintYes: hint && +hint[1], hintNo: hint && +hint[2], nextRemain, ms: Date.now() - t0 });
    await sleep(300);
  }
  return qs;
}

async function runPersona(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = { persona: p.id, name: p.name, deadEnds: [], consoleErrors: [] };
  page.on("console", (m) => m.type() === "error" && log.consoleErrors.push(m.text().slice(0, 160)));
  const tStart = Date.now();
  await page.goto(BASE, { waitUntil: "networkidle" });
  // 홈: 분야 다중 선택
  for (const d of p.domains) await page.locator("main button", { hasText: DOMAIN_LABEL[d] }).first().click();
  log.pressed = await page.locator('main button[aria-pressed="true"]').count();
  log.layout = await page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > innerWidth,
    smallTargets: [...document.querySelectorAll("main button, main a")].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height < 44; }).map((b) => b.innerText.trim().slice(0, 20)),
  }));
  log.homeText = (await mainText(page)).slice(0, 600);
  await page.locator("main button", { hasText: "시작하기" }).first().click();
  await page.waitForURL(/\/play/);
  log.playUrl = page.url();
  await sleep(1500);
  log.questions = await play(page, p, log);
  await page.waitForURL(/\/result/, { timeout: 20000 }).catch(() => {});
  await sleep(2500);
  const r = await mainText(page);
  log.taskMs = Date.now() - tStart;
  log.reachedResult = new URL(page.url()).pathname === "/result";
  log.total = Number((r.match(/전체 (\d+)개/) || [])[1]);
  log.ready = Number((r.match(/바로 신청 (\d+)개/) || [])[1]);
  log.poolStart = log.questions[0]?.remain ?? null;
  // 상위 3개 공고: 부정한 지역에 해당하는지, 근거가 분야뿐인지
  const denied = log.questions.filter((x) => x.kind === "region" && x.choose === "아니오").flatMap((x) => regionsIn(x.q));
  const cards = r.replace(/^[\s\S]*?바로 신청 \d+개/, "").split("공고 원문 보기").slice(0, 3);
  log.top3 = cards.map((c) => ({
    title: (c.split("왜 맞는지")[0].split("\n").filter((l) => !/^(D-|비정규|정규|근무지)/.test(l)).sort((a, b) => b.length - a.length)[0] || "").slice(0, 60),
    deniedRegion: denied.filter((d) => new RegExp(`(근무지|지역)[^\\n]*${d}`).test(c)),
    reasonOnlyDomain: /왜 맞는지\n분야:[^\n]*\n*$/.test(c.trim()) || ((c.split("왜 맞는지")[1] || "").trim().split("\n").filter(Boolean).every((l) => l.startsWith("분야"))),
  }));
  // 더보기 → 좁히기 버튼 유지
  const more = page.locator("main button", { hasText: "더보기" }).first();
  log.moreWorks = null;
  if (await more.count()) {
    const before = await page.locator("main a", { hasText: "원문" }).count();
    await more.click(); await sleep(800);
    log.moreWorks = (await page.locator("main a", { hasText: "원문" }).count()) > before;
  }
  log.narrowVisibleAfterMore = (await page.locator('main a[href*="continue"], main button', { hasText: "좁히기" }).count()) > 0;
  // 좁히기(추가 질문)
  await page.goto(BASE + "/result", { waitUntil: "networkidle" }); await sleep(1500);
  const narrow = page.locator("main a, main button", { hasText: "좁히기" }).first();
  log.narrow = { present: (await narrow.count()) > 0 };
  if (log.narrow.present) {
    await narrow.click(); await sleep(4000);
    log.narrow.url = new URL(page.url()).pathname + new URL(page.url()).search;
    const qs2 = await play(page, p, log);
    log.narrow.extraQuestions = qs2;
    await page.waitForURL(/\/result/, { timeout: 20000 }).catch(() => {}); await sleep(2500);
    log.narrow.totalAfter = Number(((await mainText(page)).match(/전체 (\d+)개/) || [])[1]);
  }
  // 분석: 조건별 탈락 + 탈락 공고 열람
  await page.goto(BASE + "/result/analysis", { waitUntil: "networkidle" }); await sleep(2000);
  const a = await mainText(page);
  log.analysis = { hasPerCondition: /조건별 탈락/.test(a), text: a.slice(0, 500) };
  const firstCond = page.locator("main").getByText(/−\d+/).first();
  if (await firstCond.count()) {
    const beforeA = await mainText(page); await firstCond.click().catch(() => {}); await sleep(800);
    const afterA = await mainText(page);
    log.analysis.drilldownShowsTitles = afterA !== beforeA && /공고|채용|모집|주택/.test(afterA.replace(beforeA, ""));
  } else log.analysis.drilldownShowsTitles = false;
  await page.screenshot({ path: `${ART}audit-${p.id}-analysis.png` });
  await ctx.close();
  return log;
}

async function dataChecks(page) {
  return page.evaluate(async () => {
    const t0 = Date.now();
    const j = await (await fetch("/api/opportunities")).json();
    const ms = Date.now() - t0;
    const by = {}, attrs = {};
    for (const o of j) { by[o.domain] = (by[o.domain] || 0) + 1; for (const c of o.conditions || []) attrs[c.attr] = (attrs[c.attr] || 0) + 1; }
    const urls = j.map((o) => o.url || "");
    return {
      ms, n: j.length, byDomain: by, conditionAttrs: attrs,
      badUrl: urls.filter((u) => !/^https?:\/\/[^\s,]+$/.test(u)).length,
      rootUrl: urls.filter((u) => /^https?:\/\/[^/]+\/?$/.test(u)).length,
      noApplyEnd: j.filter((o) => !o.applyEnd).length,
      dupTitle: j.length - new Set(j.map((o) => o.title)).size,
      sample: j.filter((o) => o.isSample).length,
    };
  });
}

function judge(runs, data) {
  const all = runs.flatMap((r) => r.questions);
  const regionShare = all.length ? all.filter((q) => q.kind === "region").length / all.length : 0;
  const reasked = runs.some((r) => r.questions.some((q) => q.kind === "domain" && r.domainsChosen?.length));
  const tone = all.map((q) => q.q);
  const banmal = tone.filter((q) => /(어|야|니)\?$/.test(q)).length, jondae = tone.filter((q) => /(요|까)\?$/.test(q)).length;
  const hintMismatch = all.filter((q) => q.nextRemain && q.hintYes != null && q.nextRemain !== (q.choose === "예" ? q.hintYes : q.choose === "아니오" ? q.hintNo : q.nextRemain)).length;
  const domainsAll = ["housing", "benefit", "job", "parttime", "training", "exam"];
  const c = [];
  const add = (id, name, pass, evidence) => c.push({ id, name, pass, evidence });
  add("A1", "분야 여러 개 선택 → 게임 주소에 모두 전달", runs.every((r) => r.pressed === r.domainsChosen.length && r.domainsChosen.every((d) => (r.playUrl || "").includes(d))), runs.map((r) => `${r.persona}:${r.pressed}/${r.domainsChosen.length} ${new URL(r.playUrl || BASE).search}`).join(" "));
  add("A2", "고른 분야 재질문 없음", !runs.some((r) => r.domainsChosen.length && r.questions.some((q) => q.kind === "domain" && r.domainsChosen.some((d) => DOMAIN_KW[d].test(q.q)))), runs.map((r) => r.questions.filter((q) => q.kind === "domain").map((q) => q.q).join("|")).join(" / "));
  add("A3", "질문 다양성(지역 질문 ≤40%)", regionShare <= 0.4, `지역 질문 ${(regionShare * 100).toFixed(0)}% (${all.length}문항)`);
  add("A4", "첫 결과까지 질문 수 3~8", runs.every((r) => r.questions.length >= 3 && r.questions.length <= 8), runs.map((r) => `${r.persona}:${r.questions.length}문항`).join(" "));
  add("A4b", "좁힘 효과: 결과 ≤ 시작 후보의 50%", runs.every((r) => r.total <= (r.poolStart ?? 0) * 0.5), runs.map((r) => `${r.persona}:${r.poolStart}→${r.total}`).join(" "));
  add("A5", "질문 말투 일관(반말·존댓말 혼용 없음)", !(banmal && jondae), `반말 ${banmal} / 존댓말 ${jondae}`);
  add("A6", "예/아니오 예측 수 = 실제 남은 수", hintMismatch === 0, `불일치 ${hintMismatch}/${all.length}`);
  add("A7", "상위 3개에 '아니오'한 지역 공고 없음", runs.every((r) => r.top3.every((t) => !t.deniedRegion.length)), runs.flatMap((r) => r.top3.filter((t) => t.deniedRegion.length).map((t) => `${r.persona}:${t.title}(${t.deniedRegion})`)).join(" / ") || "없음");
  add("A8", "카드 근거에 분야 외 조건 1개 이상", runs.every((r) => r.top3.every((t) => !t.reasonOnlyDomain)), runs.map((r) => `${r.persona}:${r.top3.filter((t) => t.reasonOnlyDomain).length}/3 분야만`).join(" "));
  add("A9", "더보기 후에도 '좁히기' 유지", runs.every((r) => r.moreWorks !== false && r.narrowVisibleAfterMore), runs.map((r) => `${r.persona}:더보기 ${r.moreWorks} 좁히기 ${r.narrowVisibleAfterMore}`).join(" "));
  add("A10", "'좁히기' 누르면 새 질문 → 결과 수 변화", runs.every((r) => r.narrow.present && (r.narrow.extraQuestions?.length ?? 0) > 0 && Number.isFinite(r.narrow.totalAfter) && r.narrow.totalAfter !== r.total), runs.map((r) => `${r.persona}:${r.narrow.extraQuestions?.length ?? 0}문항 ${r.total}→${r.narrow.totalAfter}`).join(" "));
  add("A11", "분석에서 조건별 탈락 공고 목록 열람", runs.every((r) => r.analysis.hasPerCondition && r.analysis.drilldownShowsTitles), runs.map((r) => `${r.persona}:조건별 ${r.analysis.hasPerCondition} 목록 ${r.analysis.drilldownShowsTitles}`).join(" "));
  add("A12", "선택 가능한 분야마다 공고 20건 이상(0건 분야는 홈에서 비활성)", domainsAll.every((d) => (data.byDomain[d] ?? 0) >= 20 || new RegExp(`${DOMAIN_LABEL[d]}[^\n]*\n?[^\n]*준비 중`).test(runs[0].homeText)), JSON.stringify(data.byDomain));
  add("A13", "원문 링크 형식 정상·루트 링크 ≤10%", data.badUrl === 0 && data.rootUrl / data.n <= 0.1, `형식 오류 ${data.badUrl}, 루트 ${data.rootUrl}/${data.n}`);
  add("A14", "조건 종류 6개 이상, 지역 조건 비중 ≤40%(질문 다양성의 원천)", Object.keys(data.conditionAttrs).filter((k) => k !== "interest").length >= 6 && (data.conditionAttrs.region ?? 0) / Object.entries(data.conditionAttrs).filter(([k]) => k !== "interest").reduce((s, [, v]) => s + v, 0) <= 0.4, JSON.stringify(data.conditionAttrs));
  add("A15", "모바일 가로 스크롤 없음·터치 영역 44px 이상(WCAG 2.2 AAA 2.5.5, AA 최소는 24px)", runs.every((r) => !r.layout.hScroll && !r.layout.smallTargets.length), runs[0].layout.smallTargets.join(",") || "없음");
  add("A16", "막다른 화면·콘솔 오류 없음", runs.every((r) => !r.deadEnds.length && !r.consoleErrors.length), runs.flatMap((r) => [...r.deadEnds.map((d) => d.text), ...r.consoleErrors]).join(" / ").slice(0, 300) || "없음");
  return c;
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome", headless: true });
const runs = [];
for (const p of PERSONAS) {
  try { const r = await runPersona(browser, p); r.domainsChosen = p.domains; runs.push(r); }
  catch (e) { runs.push({ persona: p.id, error: String(e).slice(0, 300), domainsChosen: p.domains, questions: [], top3: [], deadEnds: [{ text: String(e).slice(0, 120) }], consoleErrors: [], layout: { smallTargets: [] }, narrow: {}, analysis: {} }); }
}
const page = await (await browser.newContext()).newPage();
await page.goto(BASE);
const data = await dataChecks(page);
await browser.close();

const checks = judge(runs, data);
const metrics = {
  T1_result: `${runs.filter((r) => r.reachedResult && r.total > 0).length}/${runs.length}`,
  T2_narrow: `${runs.filter((r) => (r.narrow?.extraQuestions?.length ?? 0) > 0 && r.narrow.totalAfter !== r.total).length}/${runs.length}`,
  T3_whyExcluded: `${runs.filter((r) => r.analysis?.drilldownShowsTitles).length}/${runs.length}`,
  medianQuestions: runs.map((r) => r.questions.length).sort((a, b) => a - b)[1],
  taskSec: runs.map((r) => Math.round((r.taskMs ?? 0) / 1000)),
  deadEnds: runs.reduce((s, r) => s + r.deadEnds.length, 0),
  apiMs: data.ms,
};
const out = { base: BASE, at: new Date().toISOString(), metrics, checks, data, runs };
const file = `${ART}audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`검수 대상 ${BASE}\n지표 ${JSON.stringify(metrics)}`);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.name} — ${c.evidence}`);
console.log(`통과 ${checks.filter((c) => c.pass).length}/${checks.length}  기록 ${file}`);
process.exitCode = checks.every((c) => c.pass) ? 0 : 1;
