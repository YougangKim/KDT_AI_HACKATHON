import { describe, expect, it } from "vitest";
import { hashToken, tokenMatches, validSubscription } from "./security";

describe("서버 보안 유틸", () => {
  it("토큰은 해시로만 비교한다", () => {
    const h = hashToken("a".repeat(32));
    expect(tokenMatches("a".repeat(32), h)).toBe(true);
    expect(tokenMatches("b".repeat(32), h)).toBe(false);
    expect(tokenMatches(null, h)).toBe(false);
  });
  it("알려진 브라우저 푸시 서비스만 구독으로 받는다", () => {
    const keys = { p256dh: "x", auth: "y" };
    expect(validSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys })).toBe(true);
    expect(validSubscription({ endpoint: "https://evil.example.com/x", keys })).toBe(false);
    expect(validSubscription({ endpoint: "http://fcm.googleapis.com/x", keys })).toBe(false);
    expect(validSubscription({ endpoint: "https://fcm.googleapis.com/x" })).toBe(false);
  });
});
