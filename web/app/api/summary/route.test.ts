import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/sources", () => ({
  loadOpportunities: vi.fn(),
}));

import { _resetClient } from "@/lib/ai";
import { POST } from "./route";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  _resetClient();
  vi.clearAllMocks();
});

describe("POST /api/summary", () => {
  test("AI 키가 없으면 ai:false", async () => {
    const response = await POST(new Request("http://localhost/api/summary", {
      method: "POST",
      body: JSON.stringify({ ids: ["gov24:1"] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ai: false });
  });

  test("한 페이지 6개·상한 10개는 허용", async () => {
    for (const n of [6, 10]) {
      const response = await POST(new Request("http://localhost/api/summary", { method: "POST", body: JSON.stringify({ ids: Array.from({ length: n }, (_, i) => String(i)) }) }));
      expect(response.status).toBe(200);
    }
  });

  test("후보 id 10개 초과는 거부(한 페이지 6개는 허용)", async () => {
    const response = await POST(new Request("http://localhost/api/summary", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"] }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ai: false });
  });
});
