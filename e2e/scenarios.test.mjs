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
    env: { ...process.env, E2E_LOCAL: "1", OPPORTUNITIES_FIXTURE: POOL_FILE, GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "", JEV_API_KEY: "" },
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
  await page.route("**/play/phrase", (route) => route.fulfill({ json: { ai: false } })); // AI 문장 다듬기 끔(질문 문장 고정)
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
  }
  return "모르겠어요";
}

/** 나이 구간 버튼 중 내 나이가 들어가는 것 */
function ageOption(labels, age) {
  for (const l of labels) {
    let m;
    if ((m = l.match(/^(\d+)세 이하$/)) && age <= +m[1]) return l;
    if ((m = l.match(/^(\d+)~(\d+)세$/)) && age >= +m[1] && age <= +m[2]) return l;
    if ((m = l.match(/^(\d+)세 이상$/)) && age >= +m[1]) return l;
  }
  return "모르겠어요";
}

/** 가상 사용자 프로필로 질문에 끝까지 답한다. 물어본 질문 문장 목록을 돌려준다 */
async function playAs(page, profile) {
  const asked = [];
  for (let i = 0; i < 16; i++) {
    const location = page.getByRole("heading", { name: /내 위치와 원하는 거리/ });
    if (await location.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "건너뛰기" }).click();
    }
    const q = page.getByTestId("question");
    // 첫 화면의 위치 단계는 위치를 다루는 시나리오(d) 외에는 건너뛴다
    const skip = page.getByRole("button", { name: "건너뛰기", exact: true });
    await Promise.race([q.waitFor({ timeout: 15000 }), skip.waitFor({ timeout: 15000 }), page.waitForURL("**/result", { timeout: 15000 })]).catch(() => {});
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      continue;
    }
    if (page.url().endsWith("/result")) break;
    const text = (await q.textContent()) ?? "";
    asked.push(text);
    if (text.includes("어디에 살고")) {
      const group = page.getByRole("group", { name: "사는 지역" });
      const labels = (await group.getByRole("button").allTextContents()).filter((l) => l !== "목록에 없어요" && l !== "모르겠어요");
      const region = profile.region === "rarest" ? labels.at(-1) : profile.region;
      await group.getByRole("button", { name: labels.includes(region) ? region : "목록에 없어요", exact: true }).click();
    } else if (text.includes("기준중위소득의 몇 %")) {
      const group = page.getByRole("group", { name: "소득 구간" });
      const labels = await group.getByRole("button").allTextContents();
      await group.getByRole("button", { name: profile.income === undefined ? "모르겠어요" : incomeOption(labels, profile.income), exact: true }).click();
    } else if (text.includes("만 나이가")) {
      const group = page.getByRole("group", { name: "나이" });
      const labels = await group.getByRole("button").allTextContents();
      await group.getByRole("button", { name: ageOption(labels, profile.age ?? 27), exact: true }).click();
    } else if (text.includes("최종 학력")) {
      await page.getByRole("group", { name: "학력" }).getByRole("button", { name: profile.education ?? "대졸(4년제)", exact: true }).click();
    } else if (text.includes("어떤 집을 찾고")) {
      await page.getByRole("group", { name: "주거 형태" }).getByRole("button", { name: profile.housingKind ?? "둘 다 괜찮아요", exact: true }).click();
    } else if (/어떤 분야 일을|어떤 지원이 필요한가요|어떤 정보가 필요한가요/.test(text)) {
      const group = page.getByRole("group", { name: text.includes("분야 일을") ? "직무 분야" : text.includes("어떤 정보") ? "관심 분야" : "필요한 지원" });
      const wanted = profile.multi ?? [];
      const labels = await group.getByRole("button").allTextContents();
      const hit = labels.filter((l) => wanted.includes(l));
      if (hit.length) {
        for (const l of hit) await group.getByRole("button", { name: l, exact: true }).click();
        await group.getByRole("button", { name: /개 고르고 다음/ }).click();
      } else await group.getByRole("button", { name: /상관없어요|전부 보여 주세요/ }).click();
    } else if (text.includes("어떤 상태인가요")) {
      await page.getByRole("group", { name: "취업 상태" }).getByRole("button", { name: profile.employment ?? "모르겠어요", exact: true }).click();
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
  answer: (t) => (t.includes("무주택") ? "예" : t.includes("세 이하") ? "예" : t.includes("1인 가구") ? "아니오" : t.includes("청약통장") ? "예" : t.includes("신혼부부") ? "아니오" : t.includes("수급자") ? "아니오" : "모르겠어요"),
};

/** 반복 질문이 없는지: 고른 분야 재질문 없음, 지역·소득은 한 번씩만 */
function assertNoRepeats(asked) {
  assert.ok(!asked.some((t) => t.includes("정보가 필요한가요")), `홈에서 고른 분야를 다시 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => t.includes("살고 있나요")).length <= 1, `지역을 여러 번 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => t.includes("기준중위소득")).length <= 1, `소득을 여러 번 물음: ${asked.join(" / ")}`);
  assert.ok(asked.filter((t) => /세 이하|만 나이/.test(t)).length <= 1, `나이를 여러 번 물음: ${asked.join(" / ")}`);
  assert.equal(new Set(asked).size, asked.length, `같은 질문 반복: ${asked.join(" / ")}`);
}

const DATASETS = [["고정 데이터", FIXTURE], ["실데이터 스냅샷", SNAPSHOT], ...(process.env.LIVE_API === "1" ? [["실제 API", null]] : [])];
for (const [name, pool] of DATASETS) {
  describe(name, () => {
    before(() => usePool(pool));

    if (pool === null) {
      test("실제 공공 API 응답: 공식 출처 1곳 이상 성공, 공고 수 확인", async () => {
        const list = await (await fetch(`${BASE}/api/opportunities`)).json();
        const bySource = {};
        for (const o of list) bySource[o.source] = (bySource[o.source] ?? 0) + 1;
        console.log("실제 API 출처별 건수", JSON.stringify(bySource));
        const official = ["lh-notice", "myhome", "applyhome", "jobalio", "gov24", "qnet", "youthcenter", "work24-training"];
        assert.ok(official.some((s) => bySource[s] > 0), `공식 API 응답이 없다: ${JSON.stringify(bySource)}`);
        assert.ok(list.every((o) => !o.isSample), "예시 데이터가 섞이면 안 된다");
      });
    }

    test("a) 원하는 공고를 바로 찾는 성공 경로: 서울 무주택 취준생, 주거만", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/]);
      const asked = await playAs(page, { ...seoulJobseeker });

      console.log(`[${name}] a 질문 ${asked.length}개: ${asked.join(" / ")}`);
      assert.ok(asked.length <= 12, `질문이 너무 많다(${asked.length}): ${asked.join(" / ")}`);
      if (pool !== FIXTURE) assert.ok(asked.length >= 4, `주거만 골라도 지역·주거 형태·무주택 등 다른 조건을 물어야 한다(${asked.length})`);
      assertNoRepeats(asked);
      await page.getByRole("heading", { name: /딱 맞는 공고/ }).waitFor();
      const eligible = Number((await page.getByText(/바로 신청 \d+개/).textContent()).match(/바로 신청 (\d+)개/)[1]);
      assert.ok(eligible >= 1, "바로 신청 가능한 공고가 1개 이상");
      // 상위 3개 카드: 모두 서울 대상이고 "왜 맞는지"에 지역 근거가 있다
      const cards = page.locator("div.space-y-3 > *").filter({ hasText: "신청 페이지 열기" });
      const shown = await cards.count();
      assert.ok(shown >= 1, "결과 카드가 1개 이상 보여야 한다");
      if (pool === FIXTURE) assert.ok(shown >= 3, "고정 데이터(서울 주거 6건)에서는 카드 3개");
      for (let i = 0; i < Math.min(3, shown); i++) {
        const t = (await cards.nth(i).textContent()) ?? "";
        assert.match(t, /대상 지역: 서울/, `상위 ${i + 1}번째 카드가 서울 공고가 아니다: ${t.slice(0, 80)}`);
        assert.doesNotMatch(t, /고령자|노인/, "청년 비대상 공고가 상위에 있다");
      }
      assert.ok(await cards.first().getByText("신청 방법", { exact: true }).isVisible(), "카드에 신청 방법이 보여야 한다");
      assert.ok(await cards.first().getByRole("link", { name: /신청 페이지 열기/ }).isVisible(), "카드에 신청 페이지 링크가 보여야 한다");
      await page.screenshot({ path: ART + `a_success_${name}.png`, fullPage: true });
      await page.context().close();
    });

    test("a2) 분야를 고르지 않은 사회초년생: 서로 다른 맞춤 질문을 충분히 한다", async () => {
      const page = await newPage();
      await page.goto(`${BASE}/`);
      await page.getByRole("button", { name: /시작하기/ }).click();
      const asked = await playAs(page, { ...seoulJobseeker, region: "경기", employment: "직장인" });
      console.log(`[${name}] a2 질문 ${asked.length}개: ${asked.join(" / ")}`);
      assert.equal(new Set(asked).size, asked.length, "같은 질문 반복 없음");
      if (pool !== FIXTURE) assert.ok(asked.length >= 10, `전체 분야에서는 10개 이상 물어야 한다(${asked.length})`);
      await page.getByRole("heading", { name: /딱 맞는 공고|공고가 없어요/ }).first().waitFor();
      await page.context().close();
    });

    test("b) 조건을 여러 번 고치고 타협한 뒤 알림 설정: 서울, 주거+지원금", async () => {
      const page = await newPage();
      await start(page, [/청년 주택/, /지원금/]);
      await playAs(page, { ...seoulJobseeker });

      await page.getByRole("button", { name: /조건 고치기/ }).click();
      const groups = page.getByRole("list", { name: "내 조건" }).getByRole("group");
      const n = await groups.count();
      assert.ok(n >= 2, "고칠 조건이 2개 이상 보여야 한다");
      // 수정 1·2: 서로 다른 조건 두 개를 바꿈(타협), 수정 3: 첫 조건은 원래 답으로 되돌림(타협 철회)
      const changes = [];
      const original = await groups.nth(0).locator('[aria-pressed="true"]').textContent();
      for (const i of [0, 1]) {
        const g = groups.nth(i);
        const target = (await g.locator('[aria-pressed="true"]').textContent()) === "모름" ? "예" : "모름";
        await g.getByRole("button", { name: target, exact: true }).click();
        changes.push(await page.getByRole("status").textContent());
      }
      await groups.nth(0).getByRole("button", { name: original, exact: true }).click();
      changes.push(await page.getByRole("status").textContent());
      for (const c of changes) assert.match(c ?? "", /조건을 바꿨어요\. \d+개 → \d+개/);

      await page.getByRole("button", { name: /알림 받기/ }).click();
      await page.getByText(/저장했어요/).waitFor({ timeout: 15000 });

      await page.goto(`${BASE}/alerts`);
      await page.getByText("저장한 조건", { exact: true }).waitFor({ timeout: 10000 });
      assert.match(await page.locator("body").textContent(), /지금 서울에 살고 있나요\? ?예/, "저장한 조건에 고친 답이 남아야 한다");

      if (pool) {
        // 새 공고가 올라온 뒤 다시 조사: 내 조건에 맞는 것만, 한 번씩만 알린다
        usePool([...pool, NEW_MATCHING, NEW_OTHER_REGION]);
        await page.getByRole("button", { name: /지금 다시 조사하기/ }).click();
        await page.getByText(/다시 조사했어요\. 새 공고 \d+건/).waitFor({ timeout: 20000 });
        const body = await page.locator("body").textContent();
        assert.match(body, /다시 조사했어요\. 새 공고 1건/, "새 공고 2건 중 조건에 맞는 1건만");
        assert.ok(body.includes(NEW_MATCHING.title), "조건에 맞는 새 공고 제목이 보여야 한다");
        assert.ok(!body.includes(NEW_OTHER_REGION.title), "다른 지역 새 공고는 알리면 안 된다");

        await page.waitForTimeout(31_000); // 재조사는 30초에 한 번(남용 방지)
        await page.getByRole("button", { name: /지금 다시 조사하기/ }).click();
        await page.getByText(/다시 조사했어요\. 새 공고 0건/).waitFor({ timeout: 20000 });
        const log = await page.getByRole("heading", { name: /받은 알림/ }).locator("..").textContent();
        assert.ok(log.includes(NEW_MATCHING.title), "찾은 새 공고는 다음 조사 뒤에도 받은 알림에 남아야 한다");
        assert.ok(!log.includes(NEW_OTHER_REGION.title), "다른 지역 공고는 받은 알림에 없어야 한다");
        usePool(pool);
      }
      await page.screenshot({ path: ART + `b_alert_${name}.png`, fullPage: true });
      await page.context().close();
    });

    if (pool === FIXTURE) test("d) GPS 위치와 반경으로 결과 지도를 탐색한다", async () => {
      const page = await newPage({ latitude: 37.5665, longitude: 126.978 });
      await start(page, [/청년 주택/]);
      await page.getByRole("button", { name: /현재 위치 사용/ }).click();
      await page.getByRole("group", { name: "거리 반경" }).getByRole("button", { name: "5km", exact: true }).click();
      await page.getByRole("button", { name: /이 위치로 계속하기/ }).click();

      await playAs(page, { ...seoulJobseeker });
      await page.getByTestId("result-map").waitFor();
      assert.match(await page.locator("body").textContent(), /반경 밖 1건을 제외했어요/);

      const mapButton = page.getByRole("button", { name: "지도에서 보기" }).first();
      await mapButton.click();
      await page.locator(".leaflet-popup-content").waitFor();
      assert.ok((await page.locator(".leaflet-popup-content").textContent()).trim().length > 0, "카드에서 핀 팝업이 열려야 한다");

      const card = page.locator("article").filter({ has: page.getByRole("button", { name: "지도에서 보기" }) }).first();
      const title = (await card.getByRole("heading").first().textContent()).trim();
      await page.locator(".leaflet-marker-icon").filter({ hasText: /●|○/ }).first().click();
      await page.locator('article[data-highlighted="true"]').waitFor();
      assert.ok((await page.locator('article[data-highlighted="true"]').textContent()).includes(title), "핀에 대응하는 카드가 강조돼야 한다");

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
        answer: (t) => (t.includes("1인 가구") ? "아니오" : t.includes("무주택") ? "예" : t.includes("세 이하") ? "예" : "모르겠어요"),
      });

      const before = await total(page).catch(() => 0);
      assert.ok(before <= 3, `적은 결과여야 한다: ${before}`);
      const box = page.getByRole("region", { name: "조건 완화 제안" });
      await box.waitFor();
      const options = await box.getByRole("button").allTextContents();
      assert.ok(options.length >= 1, "완화 제안이 보여야 한다");
      for (const o of options) assert.match(o, /"모름"으로 두면 \d+건이 더 보여요|함께 보면 \d+건이 더 보여요/);
      const regionIdx = options.findIndex((o) => o.includes("다른 지역"));
      assert.ok(regionIdx === -1 || regionIdx === options.length - 1, "바꾸기 어려운 지역 완화는 마지막에 제안");
      if (fixed) assert.match(options[0], /^소득 기준을/, "소득에 막힌 경우 소득 완화를 먼저 제안");

      const promised = Number(options[0].match(/(\d+)건이 더/)[1]);
      const eligible = async () => Number((await page.getByText(/^전체 \d+개 · 바로 신청 \d+개$/).textContent().catch(() => "바로 신청 0개")).match(/바로 신청 (\d+)개/)[1]);
      const okBefore = before ? await eligible() : 0;
      await box.getByRole("button").first().click();
      const note = await page.getByText(/조건을 풀어서 \d+개 늘었어요/).textContent();
      const afterN = await total(page);
      assert.equal(afterN, before + promised, `제안한 만큼 늘어야 한다: ${before} + ${promised} → ${afterN}`);
      // 늘어난 것을 바로 신청 / 확인 필요로 나눠 알려 주고, 그 숫자가 화면과 맞아야 한다
      const split = note.match(/바로 신청 \+(\d+) · 확인 필요 \+(\d+)/);
      if (split) {
        const [okGain, checkGain] = [Number(split[1]), Number(split[2])];
        assert.equal(okGain + checkGain, promised, note);
        assert.equal(await eligible(), okBefore + okGain, "바로 신청 수가 안내와 맞아야 한다");
      } else {
        // 완화로 기존 바로 신청이 확인 필요로 내려간 경우: 음수 증가 대신 그대로 설명해야 한다
        const down = Number(note.match(/기존 바로 신청 (\d+)개도 확인 필요로 바뀜/)[1]);
        assert.equal(await eligible(), okBefore - down, `${note} / 완화 전 바로 신청 ${okBefore}`);
      }
      await page.screenshot({ path: ART + `c_relax_${name}.png`, fullPage: true });
      await page.context().close();
    });
  });
}
