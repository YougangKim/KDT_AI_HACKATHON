// 사용자 시나리오 e2e(실제 Chrome으로 화면을 끝까지 누른다)
// 실행: web에서 npm run build 후  cd e2e && npm install && npm test
// 테스트가 직접 서버(:5310)를 띄우고, 서버는 실제 출처 대신 OPPORTUNITIES_FIXTURE 파일을 읽는다.
// 데이터: 고정(fixture.mjs, 경계 상황 재현) / 실데이터 스냅샷(live-snapshot.json: 2026-11-22 13시 KST 로컬 서버 /api/opportunities 응답 991건,
//   LH·마이홈·청약홈·잡알리오·정부24·Q-Net) / LIVE_API=1이면 실제 공공 API를 그 자리에서 호출하는 스모크도 추가(키 필요).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { FIXTURE, NEW_MATCHING, NEW_OTHER_REGION } from "./fixture.mjs";

const PORT = Number(process.env.E2E_PORT ?? 5310);
const BASE = `http://localhost:${PORT}`;
const ART = fileURLToPath(new URL("./artifacts/", import.meta.url));
const WEB = fileURLToPath(new URL("../web/", import.meta.url));
const POOL_FILE = ART + "pool.json";
const SNAPSHOT = JSON.parse(readFileSync(new URL("./live-snapshot.json", import.meta.url), "utf8"));
mkdirSync(ART, { recursive: true });

let browser;
let server;
const usePool = (list) => writeFileSync(POOL_FILE, JSON.stringify(list));

before(async () => {
  usePool(FIXTURE);
  server = spawn(process.execPath, [WEB + "node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    cwd: WEB,
    // AI 키는 비워서 외부 AI 호출 없이 규칙 해석만(결과 재현성). 공고 파일은 어댑터 응답만 대체하고 후처리는 운영과 같다.
    env: { ...process.env, E2E_LOCAL: "1", OPPORTUNITIES_FIXTURE: POOL_FILE, GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "", JEV_API_KEY: "", GROQ_API_KEY: "", OPENROUTER_API_KEY: "", CF_API_TOKEN: "", CF_ACCOUNT_ID: "" },
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chrome", headless: true });
});
after(async () => {
  await browser?.close();
  server?.kill();
});

async function newPage(geolocation) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ko-KR",
    ...(geolocation ? { geolocation, permissions: ["geolocation"] } : {}),
  });
  const page = await ctx.newPage();
  await page.route("**/api/map-config", (route) => route.fulfill({ json: { key: null } })); // 회귀 테스트는 외부 지도 인증과 분리합니다.
  await page.route("**/play/phrase", (route) => route.fulfill({ json: { ai: false } })); // AI 문장 다듬기 끔(질문 문장 고정)
  await page.route("**/api/next-question", (route) => route.fulfill({ json: { ai: false, reason: "unavailable" } })); // 일반 회귀는 외부 AI와 분리, 동적 질문 테스트가 덮어쓴다
  return page;
}

async function start(page, domainButtons) {
  await page.goto(`${BASE}/`);
  for (const name of domainButtons) await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: /분야로 시작하기/ }).click();
}

/** 소득 구간 버튼 중 내 소득(%)이 들어가는 것 */
function incomeOption(labels, pct) {
  for (const l of labels) {
    let m;
    if ((m = l.match(/^(\d+)% 이하$/)) && pct <= +m[1]) return l;
    if ((m = l.match(/^(\d+)~(\d+)%$/)) && pct >= +m[1] && pct <= +m[2]) return l;
    if ((m = l.match(/^(\d+)% 초과$/)) && pct > +m[1]) return l;
    if (/^100% 초과$/.test(l) && pct > 100) return l;
  }
  return "모름";
}

/** 나이 구간 버튼 중 내 나이가 들어가는 것 */
function ageOption(labels, age) {
  for (const l of labels) {
    let m;
    if ((m = l.match(/^(\d+)세 이하$/)) && age <= +m[1]) return l;
    if ((m = l.match(/^(\d+)~(\d+)세$/)) && age >= +m[1] && age <= +m[2]) return l;
    if ((m = l.match(/^(\d+)세 이상$/)) && age >= +m[1]) return l;
  }
  return "모름";
}

/** 가상 사용자 프로필로 질문에 끝까지 답합니다. 물어본 질문 문장 목록을 돌려준다 */
async function playAs(page, profile) {
  const asked = [];
  for (let i = 0; i < 40; i++) {
    const location = page.getByRole("heading", { name: /탐색 위치와 거리 설정|내 위치와 원하는 거리/ });
    if (await location.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "건너뛰기" }).click();
    }
    const q = page.getByTestId("question");
    // 첫 화면의 위치 단계는 위치를 다루는 시나리오(d) 외에는 건너뛴다
    const skip = page.getByRole("button", { name: "건너뛰기", exact: true });
    await Promise.race([q.waitFor({ timeout: 15000 }), skip.waitFor({ timeout: 15000 }), page.waitForURL("**/result", { timeout: 15000 })]).catch(() => {});
    if (process.env.E2E_DEBUG && !(await q.isVisible().catch(() => false))) await page.screenshot({ path: ART + `debug_${i}.png` });
    if (await skip.isVisible().catch(() => false)) {
      const previous = await q.isVisible() ? await q.textContent() : null;
      await skip.click();
      if (previous) await page.waitForFunction((text) => document.querySelector('[data-testid="question"]')?.textContent !== text, previous);
      continue;
    }
    if (page.url().endsWith("/result")) break;
    const text = (await q.textContent()) ?? "";
    asked.push(text);
    if (text.includes("어디에 살고")) {
      const group = page.getByRole("group", { name: "사는 지역" });
      const labels = (await group.getByRole("button").allTextContents()).filter((l) => l !== "해당 없음" && l !== "모름");
      const region = profile.region === "rarest" ? labels.at(-1) : profile.region;
      await group.getByRole("button", { name: labels.includes(region) ? region : "해당 없음", exact: true }).click();
    } else if (text.includes("기준중위소득의 몇 %")) {
      const group = page.getByRole("group", { name: "소득 구간" });
      const labels = await group.getByRole("button").allTextContents();
      await group.getByRole("button", { name: profile.income === undefined ? "모름" : incomeOption(labels, profile.income), exact: true }).click();
    } else if (text.includes("만 나이가")) {
      const group = page.getByRole("group", { name: "나이" });
      const labels = await group.getByRole("button").allTextContents();
      await group.getByRole("button", { name: ageOption(labels, profile.age ?? 27), exact: true }).click();
    } else if (text.includes("최종 학력")) {
      await page.getByRole("group", { name: "학력" }).getByRole("button", { name: profile.education ?? "대졸(4년제)", exact: true }).click();
    } else if (text.includes("어떤 집을 찾고")) {
      await page.getByRole("group", { name: "주거 형태" }).getByRole("button", { name: profile.housingKind ?? "해당 없음", exact: true }).click();
    } else if (/어떤 분야 일을|어떤 지원이 필요합니까|어떤 정보가 필요합니까/.test(text)) {
      const group = page.getByRole("group", { name: text.includes("분야 일을") ? "직무 분야" : text.includes("어떤 정보") ? "관심 분야" : "필요한 지원" });
      const wanted = profile.multi ?? [];
      const labels = await group.getByRole("button").allTextContents();
      const hit = labels.filter((l) => wanted.includes(l));
      if (hit.length) {
        for (const l of hit) await group.getByRole("button", { name: l, exact: true }).click();
        await group.getByRole("button", { name: /개 고르고 다음/ }).click();
      } else await group.getByRole("button", { name: /해당 분야 없음|해당 없음/ }).click();
    } else if (text.includes("어떤 상태입니까")) {
      await page.getByRole("group", { name: "취업 상태" }).getByRole("button", { name: profile.employment ?? "모름", exact: true }).click();
    } else {
      await page.getByRole("button", { name: profile.answer(text), exact: true }).click();
    }
    await page.waitForFunction(
      (prev) => location.pathname === "/result" || document.querySelector('[data-testid="question"]')?.textContent !== prev,
      text,
      { timeout: 15000 },
    );
  }
  await page.waitForURL("**/result", { timeout: 15000 });
  return asked;
}

const total = async (page) => Number((await page.getByText(/^전체 \d+개/).textContent()).match(/전체 (\d+)개/)[1]);
const seoulJobseeker = {
  region: "서울",
  income: 120,
  age: 27,
  employment: "구직 중",
  education: "대졸(4년제)",
  housingKind: "임대(월세·전세)",
  multi: ["주거·자립", "고용·창업", "경영·회계·사무", "청년 주택", "지원금·혜택", "채용·인턴"],
  answer: (t) => (t.includes("무주택") ? "예" : t.includes("세 이하") ? "예" : t.includes("1인 가구") ? "아니오" : t.includes("청약통장") ? "예" : t.includes("신혼부부") ? "아니오" : t.includes("수급자") ? "아니오" : "모름"),
};

/** 반복 질문이 없는지: 고른 분야 재질문 없음, 지역·소득은 한 번씩만 */
function assertNoRepeats(asked) {
  assert.ok(!asked.some((t) => t.includes("정보가 필요합니까")), `홈에서 고른 분야를 다시 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => t.includes("살고 있습니까")).length <= 1, `지역을 여러 번 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => t.includes("기준중위소득")).length <= 1, `소득을 여러 번 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => /세 이하|만 나이/.test(t)).length <= 1, `나이를 여러 번 물음: ${asked.join(" / ")}`);
  assert.equal(new Set(asked).size, asked.length, `같은 질문 반복: ${asked.join(" / ")}`);
}

const DATASETS = [["고정 데이터", FIXTURE], ["실데이터 스냅샷", SNAPSHOT], ...(process.env.LIVE_API === "1" ? [["실제 API", null]] : [])];
for (const [name, pool] of DATASETS) {
  describe(name, () => {
    before(() => usePool(pool));

    // 이 흐름은 /api/refine-question 기반으로 바뀌어 e2e/refinement-flow.mjs가 검증한다(옛 next-question 모킹 테스트는 건너뜀)
    if (pool === FIXTURE) test.skip("동적 질문: API 문장·선택지를 표시하고 선택 후 후보와 이력을 갱신합니다", async () => {
      const page = await newPage();
      const requests = [];
      let selectedLabel = "";
      await page.route("**/api/next-question", async (route) => {
        const data = route.request().postDataJSON();
        requests.push(data);
        const facet = data.facets.find((f) => f.options.some((o) => o.remaining > 0 && o.remaining < data.total));
        if (!facet) return route.fulfill({ json: { ai: false, reason: "unavailable" } });
        const options = facet.options.map((o) => ({ key: o.key, label: `선택: ${o.label}` }));
        if (requests.length === 1) {
          const target = facet.options.filter((o) => o.remaining > 0 && o.remaining < data.total).sort((a, b) => a.remaining - b.remaining)[0];
          selectedLabel = options.find((o) => o.key === target.key).label;
        }
        return route.fulfill({ json: { ai: true, id: facet.id, question: { id: facet.id, text: `생성 질문 ${requests.length}: ${facet.text}`, why: "남은 공고의 실제 조건 차이를 확인합니다.", options } } });
      });
      await start(page, [/청년 주택/]);
      await page.getByRole("button", { name: "건너뛰기", exact: true }).click();
      await page.getByTestId("question").filter({ hasText: "생성 질문 1:" }).waitFor();
      assert.ok(requests[0].evidence.length > 0);
      assert.equal(requests[0].location, undefined);
      await page.getByRole("button", { name: selectedLabel, exact: true }).click();
      const multiNext = page.getByRole("button", { name: /개 고르고 다음/ });
      if (await multiNext.isVisible()) await multiNext.click();
      await page.waitForFunction(() => location.pathname === "/result" || (!!document.querySelector('[data-testid="question"]')?.textContent && !document.querySelector('[data-testid="question"]').textContent.startsWith("생성 질문 1:")));
      const nextCount = requests[1]?.total ?? await page.evaluate(() => JSON.parse(sessionStorage.getItem("lastResult")).matches.length);
      assert.ok(nextCount < requests[0].total, "생성된 선택지가 실제 후보를 좁혀야 합니다");
      if (requests[1]) assert.ok(requests[1].answered.length > requests[0].answered.length, "다음 요청에 답변 이력이 전달돼야 합니다");
      await page.screenshot({ path: ART + "dynamic-question.png", fullPage: true });
      await page.context().close();
    });

    if (pool === null) {
      test("실제 공공 API 응답: 공식 출처 1곳 이상 성공, 공고 수 확인", async () => {
        const list = await (await fetch(`${BASE}/api/opportunities`)).json();
        const bySource = {};
        for (const o of list) bySource[o.source] = (bySource[o.source] ?? 0) + 1;
        console.log("실제 API 출처별 건수", JSON.stringify(bySource));
        const official = ["lh-notice", "myhome", "applyhome", "jobalio", "gov24", "qnet", "youthcenter", "work24-training"];
        assert.ok(official.some((s) => bySource[s] > 0), `공식 API 응답이 없습니다: ${JSON.stringify(bySource)}`);
        assert.ok(list.every((o) => !o.isSample), "예시 데이터가 섞이면 안 됩니다");
      });
    }

    test("a) 원하는 공고를 바로 찾는 성공 경로: 서울 무주택 취준생, 주거만", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/]);
      const asked = await playAs(page, { ...seoulJobseeker });

      console.log(`[${name}] a 질문 ${asked.length}개: ${asked.join(" / ")}`);
      assert.ok(asked.length <= 12, `질문이 너무 많다(${asked.length}): ${asked.join(" / ")}`);
      if (pool !== FIXTURE) assert.ok(asked.length >= 4, `주거만 골라도 지역·주거 형태·무주택 등 다른 조건을 물어야 합니다(${asked.length})`);
      assertNoRepeats(asked);
      await page.getByRole("heading", { name: /맞춤 공고/ }).waitFor();
      const eligible = Number((await page.getByText(/바로 신청 \d+개/).textContent()).match(/바로 신청 (\d+)개/)[1]);
      assert.ok(eligible >= 1, "바로 신청 가능한 공고가 1개 이상");
      // 상위 3개 카드: 모두 서울 대상이고 "왜 맞는지"에 지역 근거가 있습니다
      const cards = page.locator("div.space-y-3 > *").filter({ hasText: "신청 페이지 열기" });
      const shown = await cards.count();
      assert.ok(shown >= 1, "결과 카드가 1개 이상 보여야 합니다");
      if (pool === FIXTURE) assert.ok(shown >= 3, "고정 데이터(서울 주거 6건)에서는 카드 3개");
      assert.doesNotMatch(await page.locator("body").textContent(), /왜 맞는지/, '"왜 맞는지" 섹션이 없어야 합니다');
      for (let i = 0; i < Math.min(3, shown); i++) {
        const t = (await cards.nth(i).textContent()) ?? "";
        assert.doesNotMatch(t, /고령자|노인/, "청년 비대상 공고가 상위에 있습니다");
      }
      assert.ok(await cards.first().getByText("신청 방법", { exact: true }).isVisible(), "카드에 신청 방법이 보여야 합니다");
      assert.ok(await cards.first().getByRole("link", { name: /신청 페이지 열기/ }).isVisible(), "카드에 신청 페이지 링크가 보여야 합니다");
      await page.screenshot({ path: ART + `a_success_${name}.png`, fullPage: true });
      await page.context().close();
    });

    test("a2) 분야를 고르지 않은 사회초년생: 서로 다른 맞춤 질문을 충분히 합니다", async () => {
      const page = await newPage();
      await page.goto(`${BASE}/`);
      await page.getByRole("button", { name: /시작하기/ }).click();
      const asked = await playAs(page, { ...seoulJobseeker, region: "경기", employment: "직장인" });
      console.log(`[${name}] a2 질문 ${asked.length}개: ${asked.join(" / ")}`);
      assert.equal(new Set(asked).size, asked.length, "같은 질문 반복 없음");
      if (pool !== FIXTURE) assert.ok(asked.length >= 10, `전체 분야에서는 10개 이상 물어야 합니다(${asked.length})`);
      await page.getByRole("heading", { name: /맞춤 공고|공고가 없습니다/ }).first().waitFor();
      await page.context().close();
    });

    test("a3) 결과 분석에서 질문을 펼치고 답을 완화합니다", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/, /지원금/]);
      await playAs(page, { ...seoulJobseeker });

      await page.getByRole("link", { name: /분석 보기/ }).first().click();
      await page.waitForURL("**/result/analysis");
      await page.getByRole("heading", { name: "질문별로 걸러진 공고" }).waitFor();

      const row = page.locator('button[aria-expanded]').first(); // 클릭 뒤에도 같은 행을 가리키게(값 조건으로 찾지 않음)
      assert.ok(await row.isVisible(), "질문별 퍼널 행이 보여야 합니다");
      await row.click();
      assert.equal(await row.getAttribute("aria-expanded"), "true");

      const relax = page.getByRole("button", { name: /답을 풀면 .*건 늘어납니다\. 적용/ }).first();
      if (await relax.isVisible().catch(() => false)) {
        await relax.click();
        await page.getByRole("status").waitFor();
      }
      await page.context().close();
    });

    test("b) 조건을 여러 번 고치고 타협한 뒤 알림 설정: 서울, 주거+지원금", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/, /지원금/]);
      await playAs(page, { ...seoulJobseeker });

      const tabs = page.getByRole("navigation", { name: "결과 분야" });
      await tabs.waitFor();
      assert.ok(await tabs.getByRole("button", { name: /^주거 \d+$/ }).isVisible(), "주거 탭이 보여야 합니다");
      assert.ok(await tabs.getByRole("button", { name: /^지원금 \d+$/ }).isVisible(), "지원금 탭이 보여야 합니다");
      await tabs.getByRole("button", { name: /^주거 \d+$/ }).click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("tab") === "housing");
      for (const domain of await page.locator("article[data-domain]").evaluateAll((items) => items.map((item) => item.getAttribute("data-domain")))) {
        assert.equal(domain, "housing", "주거 탭에는 주거 카드만 보여야 합니다");
      }
      await tabs.getByRole("button", { name: /^지원금 \d+$/ }).click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("tab") === "benefit");
      for (const domain of await page.locator("article[data-domain]").evaluateAll((items) => items.map((item) => item.getAttribute("data-domain")))) {
        assert.equal(domain, "benefit", "지원금 탭에는 지원금 카드만 보여야 합니다");
      }
      assert.doesNotMatch(await page.locator("body").textContent(), /왜 맞는지/, '"왜 맞는지" 텍스트가 없어야 합니다');
      await tabs.getByRole("button", { name: /^전체 \d+$/ }).click();

      await page.getByRole("button", { name: /조건 고치기/ }).click();
      // 예·아니오·모름으로 바꾸는 조건만 대상으로(지역·소득처럼 고르는 조건은 별도 UI)
      const groups = page.getByRole("list", { name: "내 조건" }).getByRole("group").filter({ has: page.getByRole("button", { name: "아니오", exact: true }) });
      const n = await groups.count();
      assert.ok(n >= 1, "예·아니오로 고칠 조건이 1개 이상 보여야 합니다");
      // 수정 1·2: 서로 다른 조건 두 개를 바꿈(타협), 수정 3: 첫 조건은 원래 답으로 되돌림(타협 철회)
      const changes = [];
      const original = await groups.nth(0).locator('[aria-pressed="true"]').textContent();
      for (const i of n >= 2 ? [0, 1] : [0]) {
        const g = groups.nth(i);
        const target = (await g.locator('[aria-pressed="true"]').textContent()) === "모름" ? "예" : "모름";
        await g.getByRole("button", { name: target, exact: true }).click();
        changes.push(await page.getByRole("status").filter({ hasText: "조건을 변경했습니다" }).textContent());
      }
      await groups.nth(0).getByRole("button", { name: original, exact: true }).click();
      changes.push(await page.getByRole("status").filter({ hasText: "조건을 변경했습니다" }).textContent());
      for (const c of changes) assert.match(c ?? "", /조건을 변경했습니다\. \d+개 → \d+개/);

      await page.getByRole("button", { name: /알림 받기/ }).click();
      await page.getByText(/저장했습니다/).waitFor({ timeout: 15000 });

      await page.goto(`${BASE}/alerts`);
      await page.getByText("저장한 조건", { exact: true }).waitFor({ timeout: 10000 });
      assert.match(await page.locator("body").textContent(), /지금 서울에 살고 있습니까\? ?예/, "저장한 조건에 고친 답이 남아야 합니다");

      if (pool) {
        // 새 공고가 올라온 뒤 다시 조사: 내 조건에 맞는 것만, 한 번씩만 알립니다
        usePool([...pool, NEW_MATCHING, NEW_OTHER_REGION]);
        await page.getByRole("button", { name: /지금 다시 조사하기/ }).click();
        await page.getByText(/다시 조사했습니다\. 새 공고 \d+건/).waitFor({ timeout: 20000 });
        const body = await page.locator("body").textContent();
        // 앱이 열려 있으면 화면 쪽 확인(AlertPolling)이 서버 재조사보다 먼저 새 공고를 받을 수 있습니다 → 둘 중 한 곳에서 정확히 1건
        assert.match(body, /다시 조사했습니다\. 새 공고 [01]건/, `새 공고 2건 중 조건에 맞는 것만: ${(body.match(/다시 조사했습니다[^.]*\.[^.]*\./) ?? [""])[0]}`);
        assert.ok(body.includes(NEW_MATCHING.title), "조건에 맞는 새 공고 제목이 보여야 합니다");
        assert.ok(!body.includes(NEW_OTHER_REGION.title), "다른 지역 새 공고는 알리면 안 됩니다");

        await page.waitForTimeout(31_000); // 재조사는 30초에 한 번(남용 방지)
        await page.getByRole("button", { name: /지금 다시 조사하기/ }).click();
        await page.getByText(/다시 조사했습니다\. 새 공고 0건/).waitFor({ timeout: 20000 });
        const log = await page.getByRole("heading", { name: /받은 알림/ }).locator("..").textContent();
        assert.ok(log.includes(NEW_MATCHING.title), "찾은 새 공고는 다음 조사 뒤에도 받은 알림에 남아야 합니다");
        assert.ok(!log.includes(NEW_OTHER_REGION.title), "다른 지역 공고는 받은 알림에 없어야 합니다");
        usePool(pool);
      }
      await page.screenshot({ path: ART + `b_alert_${name}.png`, fullPage: true });
      await page.context().close();
    });

    if (pool === FIXTURE) test("f) 결과에서 추가 질문으로 더 좁힌다", async () => {
      const page = await newPage();
      await page.goto(`${BASE}/`);
      await page.getByRole("button", { name: /시작하기/ }).click();
      await page.getByRole("button", { name: "건너뛰기", exact: true }).click();

      for (let i = 0; i < 2; i++) {
        const question = page.getByTestId("question");
        await question.waitFor();
        const text = await question.textContent();
        if (text.includes("어떤 정보가 필요합니까")) {
          await page.getByRole("group", { name: "관심 분야" }).getByRole("button", { name: /해당 없음/ }).click();
        } else {
          // 질문 유형마다 "모름" 버튼 문구가 다르다(모름·해당 없음·해당 없음)
          const dunno = page.getByRole("button", { name: /^(잘 )?모름$/ }).first();
          if (await dunno.isVisible().catch(() => false)) await dunno.click();
          else await page.getByRole("button", { name: /^(해당 없음|해당 없음|해당 분야 없음)$/ }).first().click();
        }
        await page.waitForFunction((previous) => location.pathname === "/result" || (!!document.querySelector('[data-testid="question"]')?.textContent && document.querySelector('[data-testid="question"]').textContent !== previous), text);
      }
      // 고정 데이터는 질문이 적어 두 번 답하면 바로 결과로 갈 수 있습니다
      const stop = page.getByRole("button", { name: /여기까지만 답하고 바로 결과 보기/ });
      if (await stop.isVisible().catch(() => false)) await stop.click();
      await page.waitForURL("**/result");
      const before = await total(page);

      // 추가 질문은 공고 원문으로 AI가 만든다. 테스트는 생성 API를 고정 응답으로 바꾼다(첫 요청만 질문, 이후는 실패)
      let calls = 0;
      await page.route("**/api/refine-question", async (route) => {
        const ids = (route.request().postDataJSON().evidence ?? []).map((e) => e.id);
        calls++;
        const half = Math.max(1, Math.floor(ids.length / 2));
        await route.fulfill({ json: calls === 1 && ids.length > 1
          ? { ai: true, question: { text: "어떤 공고를 더 보고 싶습니까?", why: "남은 공고를 둘로 나눕니다.", options: [{ label: "앞쪽 공고", ids: ids.slice(0, half) }, { label: "뒤쪽 공고", ids: ids.slice(half) }] } }
          : { ai: false, reason: "provider_unavailable" } });
      });
      await page.getByRole("link", { name: /추가 질문으로 더 좁히기/ }).click();
      await page.getByTestId("question").filter({ hasText: "어떤 공고를 더 보고 싶습니까?" }).waitFor();
      await page.getByRole("button", { name: "앞쪽 공고", exact: true }).click();
      // AI 질문이 더 안 나오면 남은 규칙 질문으로 이어 묻는다 → 끝까지 답하고 결과로
      await playAs(page, seoulJobseeker);
      await page.waitForURL("**/result");
      const message = await page.getByText(/\d+개 → \d+개로 좁혔습니다/).textContent();
      const [, from, to] = message.match(/(\d+)개 → (\d+)개/);
      assert.equal(Number(from), before, "좁히기 전 건수를 안내해야 합니다");
      assert.ok(Number(to) < Number(from), `결과 건수가 감소해야 합니다: ${message}`);
      await page.context().close();
    });

    if (pool === FIXTURE) test("g) 정렬·보고 싶은 수를 고르고, 수가 넘치면 그 수 이하로 좁히기 링크가 나온다", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/, /지원금/]);
      await playAs(page, { region: "서울", answer: () => "모름" });
      await page.waitForURL("**/result");
      const total0 = await total(page);
      await page.getByRole("combobox", { name: "정렬" }).selectOption("deadline");
      await page.getByRole("combobox", { name: "보고 싶은 공고 수" }).selectOption("10");
      const cards = await page.locator("article").count();
      assert.ok(cards >= 1 && cards <= 10, `카드 수 ${cards}`);
      if (total0 > 10) {
        const href = await page.getByRole("link", { name: /10개 이하로 좁히기/ }).getAttribute("href");
        assert.match(href ?? "", /target=10/);
      }
      await page.context().close();
    });

    if (pool === FIXTURE) test("d) GPS 위치와 반경으로 결과 지도를 탐색합니다", async () => {
      const page = await newPage({ latitude: 37.5665, longitude: 126.978 });
      await start(page, [/청년 주택/]);
      await page.getByRole("button", { name: /현재 위치 사용/ }).click();
      await page.getByRole("group", { name: "거리 반경" }).getByRole("button", { name: "5km", exact: true }).click();
      await page.getByRole("button", { name: /이 위치로 계속하기/ }).click();

      await playAs(page, { ...seoulJobseeker });
      await page.getByTestId("result-map").waitFor();
      // 반경은 지도·거리 정렬용이라 공고를 숨기지 않는다(사용자 결정). 거리 표시만 확인
      assert.match(await page.locator("body").textContent(), /내 위치에서 \d+(\.\d+)?km/);

      assert.equal(await page.getByRole("button", { name: "지도에서 보기" }).count(), 0, "불필요한 지도 버튼은 숨긴다");
      await page.locator(".leaflet-marker-icon").filter({ hasNot: page.getByText("나", { exact: true }) }).last().click(); // 묶음 핀도 허용
      await page.locator('article[data-highlighted="true"]').waitFor();
      const title = (await page.locator(".leaflet-popup-content strong").textContent()).trim();
      assert.ok((await page.locator('article[data-highlighted="true"]').textContent()).includes(title), "핀에 대응하는 카드가 강조돼야 합니다");

      await page.context().close();
    });

    if (pool === FIXTURE) test("e) 알림 설정 화면에서 조건·일정·모드를 바꾸고 저장이 유지됩니다", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/, /지원금/]);
      await playAs(page, { ...seoulJobseeker });
      await page.getByRole("button", { name: /알림 받기/ }).click();
      await page.getByText(/저장했습니다/).waitFor({ timeout: 15000 });

      await page.goto(`${BASE}/settings`);
      await page.getByRole("heading", { name: /알림 설정/ }).waitFor();
      const body0 = await page.locator("body").textContent();
      assert.match(body0, /청년/, "내 조건이 문장으로 보여야 합니다");

      // 조건 하나 바꾸기(첫 조건을 모름으로)
      const groups = page.getByRole("list", { name: "내 조건" }).getByRole("group").filter({ has: page.getByRole("button", { name: "아니오", exact: true }) });
      await groups.first().getByRole("button", { name: "모름", exact: true }).click();
      // 일정: 간격 30분, 모드: 정해진 시간마다
      await page.getByRole("button", { name: "간격", exact: true }).click();
      await page.getByRole("group", { name: "알림 간격" }).getByRole("button", { name: "30분", exact: true }).click();
      await page.getByRole("button", { name: "정해진 시간마다 요약 받기" }).click();
      await page.getByRole("button", { name: "설정 저장" }).click();
      await page.getByText(/저장했습니다|동기화에 실패/).waitFor({ timeout: 15000 });

      await page.reload();
      await page.getByRole("heading", { name: /알림 설정/ }).waitFor();
      assert.equal(await page.getByRole("button", { name: "정해진 시간마다 요약 받기" }).getAttribute("aria-pressed"), "true", "모드가 유지돼야 합니다");
      assert.equal(await page.getByRole("group", { name: "알림 간격" }).getByRole("button", { name: "30분", exact: true }).getAttribute("aria-pressed"), "true", "간격이 유지돼야 합니다");
      assert.equal(await page.getByRole("list", { name: "내 조건" }).getByRole("group").filter({ has: page.getByRole("button", { name: "아니오", exact: true }) }).first().locator('[aria-pressed="true"]').textContent(), "모름", "바꾼 조건이 유지돼야 합니다");
      await page.screenshot({ path: ART + "e_settings.png", fullPage: true });
      await page.context().close();
    });

    test("c) 공고가 너무 적을 때 완화할 조건을 설명", async () => {
      const page = await newPage();
      // 고정: 부산·소득 200%·지원금만(소득 기준에 막힘) / 실데이터: 공고가 가장 적은 지역·주거만
      const fixed = pool === FIXTURE;
      await start(page, fixed ? [/지원금/] : [/청년 주택/]);
      await playAs(page, {
        region: fixed ? "부산" : "rarest",
        income: 200,
        answer: (t) => (t.includes("1인 가구") ? "아니오" : t.includes("무주택") ? "예" : t.includes("세 이하") ? "예" : "모름"),
      });

      const before = await total(page).catch(() => 0);
      assert.ok(before <= 3, `적은 결과여야 합니다: ${before}`);
      const box = page.getByRole("region", { name: "조건 완화 제안" });
      await box.waitFor();
      const options = await box.getByRole("button").allTextContents();
      assert.ok(options.length >= 1, "완화 제안이 보여야 합니다");
      for (const o of options) assert.match(o, /"모름"으로 두면 \d+건이 더 표시됩니다|함께 보면 \d+건이 더 표시됩니다/);
      const regionIdx = options.findIndex((o) => o.includes("다른 지역"));
      assert.ok(regionIdx === -1 || regionIdx === options.length - 1, "바꾸기 어려운 지역 완화는 마지막에 제안");
      if (fixed) assert.match(options[0], /^소득 기준을/, `소득에 막힌 경우 소득 완화를 먼저 제안: ${options.join(" / ")}`);

      const promised = Number(options[0].match(/(\d+)건이 더/)[1]);
      const eligible = async () => Number((await page.getByText(/^전체 \d+개 · 바로 신청 \d+개$/).textContent().catch(() => "바로 신청 0개")).match(/바로 신청 (\d+)개/)[1]);
      const okBefore = before ? await eligible() : 0;
      await box.getByRole("button").first().click();
      const note = await page.getByText(/조건을 풀어서 \d+개 늘었습니다/).textContent();
      const afterN = await total(page);
      assert.equal(afterN, before + promised, `제안한 만큼 늘어야 합니다: ${before} + ${promised} → ${afterN}`);
      // 늘어난 것을 바로 신청 / 확인 필요로 나눠 알려 주고, 그 숫자가 화면과 맞아야 합니다
      const split = note.match(/바로 신청 \+(\d+) · 확인 필요 \+(\d+)/);
      if (split) {
        const [okGain, checkGain] = [Number(split[1]), Number(split[2])];
        assert.equal(okGain + checkGain, promised, note);
        assert.equal(await eligible(), okBefore + okGain, "바로 신청 수가 안내와 맞아야 합니다");
      } else {
        // 완화로 기존 바로 신청이 확인 필요로 내려간 경우: 음수 증가 대신 그대로 설명해야 합니다
        const down = Number(note.match(/기존 바로 신청 (\d+)개도 확인 필요로 바뀜/)[1]);
        assert.equal(await eligible(), okBefore - down, `${note} / 완화 전 바로 신청 ${okBefore}`);
      }
      await page.screenshot({ path: ART + `c_relax_${name}.png`, fullPage: true });
      await page.context().close();
    });
  });
}
