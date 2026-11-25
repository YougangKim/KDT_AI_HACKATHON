import { afterEach, describe, expect, it, vi } from "vitest";

// Upstash(REST) 모드: 저장 TTL이 마지막 접속 기준으로 계산되는지(자동 조사로 연장 안 됨)
describe("서버 조건 TTL(Redis)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

  it("EX = 마지막 접속 + 14일 − 지금, 지났으면 저장 대신 삭제", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const calls: unknown[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => { calls.push(JSON.parse(init.body)); return new Response(JSON.stringify({ result: "OK" })); }));
    vi.resetModules();
    const { putRecord } = await import("./store");
    const base = { id: "redis-ttl-1", watch: { answers: [], domains: [], seenIds: [] }, totalNew: 0 } as never as import("./store").WatchRecord;
    await putRecord({ ...base, lastSeenAt: new Date(Date.now() - 4 * 864e5).toISOString() });
    const set = calls.find((c) => c[0] === "SET")!;
    expect(set[3]).toBe("EX");
    expect(Number(set[4])).toBeGreaterThan(9.9 * 86400);
    expect(Number(set[4])).toBeLessThanOrEqual(10 * 86400);
    calls.length = 0;
    await putRecord({ ...base, lastSeenAt: new Date(Date.now() - 15 * 864e5).toISOString() });
    expect(calls.some((c) => c[0] === "SET")).toBe(false);
    expect(calls.some((c) => c[0] === "DEL")).toBe(true);
  });
});
