import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  _clearAiCacheMemory,
  cacheKey,
  cachedResult,
  getCached,
  setCached,
  stableJson,
} from "./cache";

beforeEach(() => {
  _clearAiCacheMemory();
  vi.stubEnv("AI_CACHE_DISABLE_FILE", "1");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI 영구 캐시", () => {
  test("키는 입력 SHA-256 앞 24자다", () => {
    expect(cacheKey("same")).toMatch(/^[0-9a-f]{24}$/);
    expect(cacheKey("same")).toBe(cacheKey("same"));
    expect(cacheKey("other")).not.toBe(cacheKey("same"));
  });

  test("메모리 폴백으로 값을 저장하고 읽는다", async () => {
    await setCached("test", "v1\ninput", { ok: true }, 1);
    expect(await getCached("test", "v1\ninput")).toEqual({ ok: true });
  });

  test("프롬프트 버전이 바뀌면 기존 값을 사용하지 않는다", async () => {
    await setCached("test", "v1\ninput", "old", 1);
    expect(await getCached("test", "v2\ninput")).toBeNull();
  });

  test("Upstash가 없으면 파일 캐시를 재사용합니다", async () => {
    vi.stubEnv("AI_CACHE_DISABLE_FILE", "0");
    vi.mock("node:fs/promises", () => {
      let contents = "{}";
      return {
        mkdir: vi.fn(),
        readFile: vi.fn(async () => contents),
        writeFile: vi.fn(async (_path, value) => {
          contents = String(value);
        }),
      };
    });

    await setCached("file-test", "v1\ninput", "saved", 1);
    _clearAiCacheMemory();
    expect(await getCached("file-test", "v1\ninput")).toBe("saved");
  });

  test("객체 키 순서가 달라도 같은 정규화 JSON을 만든다", () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  });

  test("동일 키의 동시 생성을 한 번만 실행한다", async () => {
    let calls = 0;
    const create = async () => {
      calls++;
      await Promise.resolve();
      return { ok: true };
    };
    const [a, b] = await Promise.all([
      cachedResult("single-flight", "same", 1, create),
      cachedResult("single-flight", "same", 1, create),
    ]);
    expect([a, b]).toEqual([{ ok: true }, { ok: true }]);
    expect(calls).toBe(1);
  });
});
