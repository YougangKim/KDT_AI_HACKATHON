import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "../types";

const stored: Opportunity = {
  id: "stored:1",
  domain: "benefit",
  title: "저장 공고",
  org: "기관",
  region: [],
  summary: "",
  conditions: [],
  url: "https://example.com/stored",
  source: "stored",
  isSample: false,
  fetchedAt: "2026-11-23T00:00:00.000Z",
};
let collectedAt = "2026-11-23T00:00:00.000Z";
const trigger = vi.fn();

vi.mock("../server/pool", () => ({
  readPool: vi.fn(async () => ({
    meta: { collectedAt, sources: {} },
    items: [stored],
  })),
  triggerPoolCollection: trigger,
}));

import { _clearCache, loadOpportunities } from "./index";

describe("공고 풀 신선도", () => {
  beforeEach(() => {
    _clearCache();
    trigger.mockClear();
    delete process.env.OPPORTUNITIES_FIXTURE;
    delete process.env.DATA_GO_KR_KEY;
    delete process.env.YOUTHCENTER_API_KEY;
    delete process.env.WORK24_TRAINING_KEY;
  });

  it("6시간 이내 저장본을 반환합니다", async () => {
    collectedAt = "2026-11-23T00:00:00.000Z";
    const result = await loadOpportunities(
      ["benefit"],
      new Date("2026-11-23T05:59:00.000Z"),
    );
    expect(result).toEqual([stored]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it("오래된 저장본이면 라이브 폴백과 백그라운드 수집을 사용합니다", async () => {
    collectedAt = "2026-11-22T00:00:00.000Z";
    const result = await loadOpportunities(
      ["benefit"],
      new Date("2026-11-23T00:00:00.000Z"),
    );
    expect(result).toEqual([]);
    expect(trigger).toHaveBeenCalledOnce();
  });
});
