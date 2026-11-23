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
