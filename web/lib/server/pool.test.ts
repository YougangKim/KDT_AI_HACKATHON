import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "../types";
import { collectLiveOpportunities } from "@/lib/sources";

const { adapters, flags } = vi.hoisted(() => ({
  adapters: [
    { id: "one", domains: ["benefit"], envKey: "ONE", fetch: () => Promise.resolve([]) },
    { id: "two", domains: ["benefit"], envKey: "TWO", fetch: () => Promise.resolve([]) },
  ],
  flags: { failTwo: false, large: false },
}));

function opportunity(source: string, summary = source): Opportunity {
  return {
    id: `${source}:1`,
    domain: "benefit",
    title: source,
    org: source,
    region: [],
    summary,
    conditions: [],
    url: "https://example.com",
    source,
    isSample: false,
    fetchedAt: "2026-11-23T00:00:00.000Z",
  };
}

vi.mock("@/lib/sources", () => ({
  ADAPTERS: adapters,
  ALL_DOMAINS: ["housing", "job", "parttime", "benefit", "training", "exam"],
  collectLiveOpportunities: vi.fn(async (
    _domains: unknown,
    _now: unknown,
    options: { adapters: typeof adapters; onSource: (status: unknown) => void },
  ) => {
    const out: Opportunity[] = [];
    for (const adapter of options.adapters) {
      if (adapter.id === "two" && flags.failTwo) {
        options.onSource({ source: "two", ok: false, count: 0, durationMs: 1, calls: 1, error: "fail" });
        continue;
      }
      const item = opportunity(adapter.id, flags.large ? "가".repeat(500_000) : adapter.id);
      out.push(item);
      options.onSource({ source: adapter.id, ok: true, count: 1, durationMs: 1, calls: 1 });
    }
    return out;
  }),
}));

import {
  _clearPoolMemory,
  collectPool,
  readPool,
  splitPoolChunks,
} from "./pool";

/** Upstash REST 흉내: SET(NX 지원)·GET·DEL·EXPIRE(만료는 기록만) */
function stubRedis(store: Map<string, string>, log: string[]) {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    const [cmd, key, value, ...rest] = JSON.parse(init.body) as string[];
    log.push(`${cmd} ${key}`);
    let result: unknown = "OK";
    if (cmd === "SET") {
      if (rest.includes("NX") && store.has(key)) result = null;
      else store.set(key, value);
    }
    if (cmd === "GET") result = store.get(key) ?? null;
    if (cmd === "DEL") store.delete(key);
    return new Response(JSON.stringify({ result }));
  }));
}

describe("공고 풀", () => {
  beforeEach(() => {
    process.env.POOL_CACHE_DISABLE_FILE = "1";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    flags.failTwo = false;
    flags.large = false;
    _clearPoolMemory();
  });

  it("일부 출처 실패 시 이전 저장본을 유지합니다", async () => {
    await collectPool(new Date("2026-11-23T00:00:00Z"));
    flags.failTwo = true;
    await collectPool(new Date("2026-11-23T00:16:00Z"));

    const pool = await readPool();
    expect(pool?.items.map((item) => item.source).sort()).toEqual(["one", "two"]);
    expect(pool?.meta.sources.two).toMatchObject({
      ok: false,
      count: 1,
      error: "fail",
    });
  });

  it("900KB를 넘는 출처 값을 조각낸 뒤 순서를 보존합니다", () => {
    const items = [
      opportunity("one", "가".repeat(500_000)),
      { ...opportunity("one", "나".repeat(500_000)), id: "one:2" },
    ];
    const chunks = splitPoolChunks(items);
    expect(chunks).toHaveLength(2);
    expect(chunks.flat().map((item) => item.id)).toEqual(["one:1", "one:2"]);
  });

  it("조각 수가 바뀌어도 예전 조각을 바로 지우지 않고 새 meta 저장 뒤 만료만 건다(수집 중 빈 출처 방지)", async () => {
    const store = new Map<string, string>();
    const log: string[] = [];
    stubRedis(store, log);
    try {
      await collectPool(new Date("2026-11-23T00:00:00Z")); // 출처마다 1조각
      flags.large = true; // 이번엔 출처 값이 커서 여러 조각 → 단일 키는 지워야 함
      vi.mocked(collectLiveOpportunities).mockImplementationOnce(async (_d, _n, options) => {
        const big = [opportunity("one", "가".repeat(500_000)), { ...opportunity("one", "나".repeat(500_000)), id: "one:2" }];
        options?.onSource?.({ source: "one", ok: true, count: 2, durationMs: 1, calls: 1 });
        options?.onSource?.({ source: "two", ok: true, count: 1, durationMs: 1, calls: 1 });
        return [...big, opportunity("two")];
      });
      const oldKeys = [...store.keys()].filter((k) => k.startsWith("pool:v1:one:"));
      expect(oldKeys).toHaveLength(1);
      log.length = 0;
      await collectPool(new Date("2026-11-23T00:16:00Z"));
      const metaAt = log.indexOf("SET pool:v1:meta");
      expect(metaAt).toBeGreaterThanOrEqual(0);
      // 새 세대 키에 쓰고(예전 키를 덮어쓰지 않음), 예전 키는 지우지 않고 meta 저장 뒤 만료만 건다
      // → 예전 meta를 읽은 동시 요청도 빈 출처를 보지 않고, 예전 키가 다시 쓰이지 않아 만료가 현재 키에 걸리지 않는다
      expect(log.some((l) => l.startsWith("DEL ") && l !== "DEL pool:v1:lock")).toBe(false);
      expect(log.filter((l) => l.startsWith("SET ") && oldKeys.some((k) => l === `SET ${k}`))).toHaveLength(0);
      expect(log.indexOf(`EXPIRE ${oldKeys[0]}`)).toBeGreaterThan(metaAt);
      expect(store.get(oldKeys[0])).toBeTruthy();
      expect((await readPool())?.items.filter((i) => i.source === "one")).toHaveLength(2);
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });

  it("다른 수집이 락을 잡고 있으면 수집하지 않고 저장본을 돌려준다(동시 수집이 meta를 덮어쓰지 않게)", async () => {
    const store = new Map<string, string>();
    const log: string[] = [];
    stubRedis(store, log);
    try {
      await collectPool(new Date("2026-11-23T00:00:00Z"));
      expect(store.has("pool:v1:lock")).toBe(false); // 끝나면 락을 푼다
      store.set("pool:v1:lock", "someone-else");
      const metaBefore = store.get("pool:v1:meta");
      log.length = 0;
      await collectPool(new Date("2026-11-23T00:16:00Z"));
      expect(log.filter((l) => l.startsWith("SET ") && l !== "SET pool:v1:lock")).toHaveLength(0);
      expect(store.get("pool:v1:meta")).toBe(metaBefore);
      expect(store.get("pool:v1:lock")).toBe("someone-else"); // 남의 락은 지우지 않는다
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });

  it("키 등록 전 건너뛴 출처는 등록 직후 다시 수집합니다", async () => {
    vi.mocked(collectLiveOpportunities).mockImplementationOnce(async (_domains, _now, options) => {
      options?.onSource?.({ source: "one", ok: true, count: 0, calls: 0, durationMs: 0 });
      return [];
    });
    await collectPool(new Date("2026-11-23T00:00:00Z"));
    vi.stubEnv("ONE", "test-key");
    try {
      await collectPool(new Date("2026-11-23T00:00:01Z"));
      expect((await readPool())?.meta.sources.one.calls).toBe(1);
      expect((await readPool())?.items.some((item) => item.source === "one")).toBe(true);
    } finally { vi.unstubAllEnvs(); }
  });
});
