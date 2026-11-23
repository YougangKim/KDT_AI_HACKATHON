import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
afterEach(() => vi.unstubAllEnvs());
it("접두사 없는 JavaScript 키만 반환합니다", async () => {
  vi.stubEnv("KAKAO_MAP_KEY", "javascript-test");
  vi.stubEnv("KAKAO_REST_API_KEY", "rest-private-test");
  const response = await GET();
  expect(await response.json()).toEqual({ key: "javascript-test" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("REST 키를 잘못 넣으면 브라우저에 노출하지 않는다", async () => {
  vi.stubEnv("KAKAO_MAP_KEY", "rest-private-test");
  vi.stubEnv("KAKAO_REST_API_KEY", "rest-private-test");
  expect(await (await GET()).json()).toEqual({ key: null });
});
