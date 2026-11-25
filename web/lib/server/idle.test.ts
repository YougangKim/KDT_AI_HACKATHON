import { describe, expect, it } from "vitest";
import { getRecord, putRecord, idleExpired, type WatchRecord } from "./store";

const rec = (lastSeenAt?: string): WatchRecord => ({ id: "idle-test-1", watch: { answers: [], domains: [], seenIds: [] } as unknown as WatchRecord["watch"], totalNew: 0, lastSeenAt });

describe("서버 조건 14일 미접속 삭제", () => {
  it("마지막 접속 후 14일 지나면 만료", () => {
    expect(idleExpired(rec(new Date(Date.now() - 15 * 864e5).toISOString()))).toBe(true);
    expect(idleExpired(rec(new Date(Date.now() - 3 * 864e5).toISOString()))).toBe(false);
  });
  it("만료된 기록은 읽을 때 지운다(메모리 모드)", async () => {
    await putRecord(rec(new Date(Date.now() - 3 * 864e5).toISOString()));
    expect(await getRecord("idle-test-1")).not.toBeNull();
    await putRecord(rec(new Date(Date.now() - 20 * 864e5).toISOString()));
    expect(await getRecord("idle-test-1")).toBeNull();
  });
});
