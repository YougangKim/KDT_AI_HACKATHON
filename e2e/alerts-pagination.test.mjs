import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { chromium } from "playwright-core";

const BASE = process.env.UI_BASE ?? "http://localhost:3950";

test("notification click waits for navigation before focusing, including closed app", async () => {
  const handlers = {};
  const calls = [];
  let clients = [{ navigate: async (url) => { calls.push(url); return { focus: () => calls.push("focus") }; }, focus: () => calls.push("old-focus") }];
  const self = { addEventListener: (name, fn) => handlers[name] = fn, clients: { matchAll: async () => clients, openWindow: (url) => calls.push(url) } };
  vm.runInNewContext(readFileSync(new URL("../web/public/sw.js", import.meta.url), "utf8"), { self });
  let done;
  const url = "/alerts?alert=new%3Aitem7";
  handlers.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: (p) => done = p });
  await done;
  assert.deepEqual(calls, [url, "focus"]);
  clients = [];
  handlers.notificationclick({ notification: { close() {} }, waitUntil: (p) => done = p });
  await done;
  assert.equal(calls.at(-1), "/alerts");
});

test("mobile and desktop: inbox tabs, exact notification, bounded lists, preserved news", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const answers = ["homeless", "livingAlone", "subscription", "married", "welfare", "experienced"].map((attr) => ({ question: { id: attr, attr, op: "eq", value: true, text: `${attr} 확인` }, answer: "yes" }));
  const pool = Array.from({ length: 13 }, (_, i) => ({ id: `live:${i}`, title: `공고 ${i}`, domain: "job", org: "기관", region: [], conditions: [], summary: "공고 내용", url: `https://example.com/${i}`, source: "api", origin: "api", isSample: false, fetchedAt: new Date().toISOString() }));
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      await context.addInitScript(({ answers, pool }) => {
        if (!sessionStorage.getItem("uiTestSeeded")) {
        sessionStorage.setItem("uiTestSeeded", "1");
        localStorage.setItem("watch", JSON.stringify({ createdAt: new Date().toISOString(), domains: ["job"], answers, seenIds: [] }));
        localStorage.setItem("alertLog", JSON.stringify(pool.slice(0, 12).map((o) => ({ id: `new:${o.id}`, opportunityId: o.id, kind: "new", title: o.title, body: o.summary, url: o.url, createdAt: new Date().toISOString(), read: false }))));
        sessionStorage.setItem("lastResult", JSON.stringify({ pool, answers, matches: [] }));
        }
        Object.defineProperty(Notification, "permission", { get: () => "granted" });
        navigator.serviceWorker.register = async () => ({ showNotification: async (title, options) => { window.testNotification = { title, options }; } });
      }, { answers, pool });
      const page = await context.newPage();
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        const data = path === "/api/push" ? { publicKey: null } : path === "/api/watch" ? { saved: true, history: [], lastNewTitles: pool.map((o) => o.title) } : path === "/api/opportunities" ? pool : path === "/api/insights" ? { provider: "test", items: [{ title: "통계 자료 유지 확인", snippet: "통계 내용", url: "https://example.com/news" }] } : {};
        return route.fulfill({ json: data });
      });
      await page.goto(`${BASE}/alerts`);
      await page.getByRole("list", { name: "받은 공고", exact: true }).waitFor();
      assert.equal(await page.getByRole("tab").count(), 4);
      assert.equal(await page.getByRole("list", { name: "받은 공고", exact: true }).locator("li").count(), 5);
      await page.getByRole("navigation", { name: "받은 공고 페이지" }).getByRole("button", { name: "다음" }).click();
      assert.equal(await page.getByRole("list", { name: "받은 공고", exact: true }).locator("li").count(), 5);
      await page.getByRole("navigation", { name: "받은 공고 페이지" }).getByRole("button", { name: "다음" }).click();
      assert.equal(await page.getByRole("list", { name: "받은 공고", exact: true }).locator("li").count(), 3);
      await page.getByRole("tab", { name: "리서치 현황" }).click();
      assert.equal(await page.getByRole("list", { name: "최근 조사 공고", exact: true }).locator("li").count(), 5);
      assert.equal(await page.getByRole("list", { name: "받은 공고", exact: true }).count(), 0);
      await page.getByRole("tab", { name: "저장 조건" }).click();
      assert.equal(await page.getByRole("list", { name: "저장 답변", exact: true }).locator("li").count(), 5);
      await page.getByRole("tab", { name: "저장 조건" }).press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "설정", exact: true }).getAttribute("aria-selected"), "true");
      await page.getByRole("button", { name: "새 공고 확인", exact: true }).click();
      await page.waitForFunction(() => window.testNotification);
      const url = await page.evaluate(() => window.testNotification.options.data.url);
      assert.equal(url, "/alerts?alert=new%3Alive%3A12");
      await page.goto(`${BASE}${url}`);
      await page.getByText("선택한 알림의 공고입니다.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("list", { name: "받은 공고", exact: true }).locator("li").count(), 1);
      assert.equal(await page.getByRole("heading", { name: "저장한 조건" }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `e2e/artifacts/notification-${width}.png` });
      await page.goto(`${BASE}/result/analysis`);
      await page.getByRole("list", { name: "질문별 분석", exact: true }).waitFor();
      assert.equal(await page.getByRole("list", { name: "질문별 분석", exact: true }).locator(":scope > li").count(), 5);
      await page.getByRole("navigation", { name: "질문별 분석 페이지" }).getByRole("button", { name: "다음" }).click();
      assert.equal(await page.getByRole("list", { name: "질문별 분석", exact: true }).locator(":scope > li").count(), 1);
      await page.getByText("전체 답변 수정", { exact: true }).click();
      assert.equal(await page.getByRole("list", { name: "내 조건", exact: true }).locator(":scope > li").count(), 5);
      await page.getByRole("navigation", { name: "분석 분야" }).getByRole("button", { name: "채용", exact: true }).click();
      await page.getByRole("button", { name: "관련 자료 조회" }).click();
      await page.getByText("통계 자료 유지 확인 ↗").waitFor();
      await page.goto(`${BASE}/settings`);
      await page.getByText("상세 조건 수정", { exact: true }).waitFor();
      assert.equal(await page.getByRole("list", { name: "내 조건", exact: true }).isVisible(), false);
      await page.getByText("상세 조건 수정", { exact: true }).click();
      assert.equal(await page.getByRole("list", { name: "내 조건", exact: true }).locator(":scope > li").count(), 5);
      await context.close();
    }
  } finally { await browser.close(); }
});
