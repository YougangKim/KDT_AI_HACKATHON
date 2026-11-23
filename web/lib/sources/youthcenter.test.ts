import { afterEach, expect, it, vi } from "vitest";
import { youthcenter } from "./youthcenter";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("등록된 YOUTHCENTER_API_KEY로 공식 API를 조회하고 공고로 변환합니다", async () => {
  vi.stubEnv("YOUTHCENTER_API_KEY", "test-youth-key");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    resultCode: 200,
    result: { youthPolicyList: [{ plcyNo: "P1", plcyNm: "청년 주거 지원", lclsfNm: "주거" }] },
  })));
  vi.stubGlobal("fetch", fetchMock);
  expect(youthcenter.envKey).toBe("YOUTHCENTER_API_KEY");
  const items = await youthcenter.fetch(new Date("2026-11-23"));
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.origin).toBe("https://www.youthcenter.go.kr");
  expect(url.searchParams.get("apiKeyNm")).toBe("test-youth-key");
  expect(items[0]).toMatchObject({ id: "youthcenter:P1", domain: "housing", isSample: false });
});
