import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "@/lib/types";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  setVapidDetails: vi.fn(),
  sendNotification,
}));

const pool: Opportunity[] = [{
  id: "matched",
  domain: "housing",
  title: "조건에 맞는 공고",
  org: "기관",
  region: [],
  summary: "",
  conditions: [],
  applyEnd: "2026-11-24",
  url: "https://example.com",
  source: "test",
  isSample: false,
  fetchedAt: "2026-11-20T00:00:00Z",
}];

vi.mock("@/lib/sources", () => ({ loadOpportunities: async () => pool }));
const { scanOne } = await import("./scan");

describe("scanOne digest", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    process.env.VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
  });

  it("새 공고가 없어도 정기 요약 페이로드를 보낸다", async () => {
    await scanOne({
      id: "digest-test",
      totalNew: 0,
      subscription: {
        endpoint: "https://push.example.com",
        keys: { p256dh: "key", auth: "auth" },
      },
      watch: {
        createdAt: "2026-11-20T00:00:00Z",
        answers: [],
        domains: ["housing"],
        seenIds: ["matched"],
        mode: "digest",
      },
    }, new Date("2026-11-21T10:00:00Z"));

    expect(sendNotification).toHaveBeenCalledOnce();
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({
      title: "My News 정기 요약",
      body: "오늘 조건에 맞는 공고 1개, 마감 임박 1개",
    });
  });
});
