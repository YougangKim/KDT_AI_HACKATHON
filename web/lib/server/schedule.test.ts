import { describe, expect, it } from "vitest";
import type { WatchRecord } from "./store";
import { isDue } from "./schedule";

function record(
  schedule: WatchRecord["watch"]["schedule"],
  lastScanAt?: string,
): WatchRecord {
  return {
    id: "schedule-test",
    totalNew: 0,
    lastScanAt,
    watch: {
      createdAt: "2026-11-20T00:00:00Z",
      answers: [],
      domains: [],
      seenIds: [],
      schedule,
    },
  };
}

describe("isDue", () => {
  it("기본 일정은 KST 오전 9시 이후 하루 한 번", () => {
    expect(isDue(record(undefined, "2026-11-21T23:00:00Z"), new Date("2026-11-22T00:01:00Z"))).toBe(true);
    expect(isDue(record(undefined, "2026-11-22T00:01:00Z"), new Date("2026-11-22T00:10:00Z"))).toBe(false);
  });

  it("여러 시각 중 지난 시각 이후 확인하지 않은 항목이 있으면 due", () => {
    const schedule = { kind: "times" as const, times: ["09:00", "18:00"] };
    expect(isDue(record(schedule, "2026-11-22T00:05:00Z"), new Date("2026-11-22T09:01:00Z"))).toBe(true);
    expect(isDue(record(schedule, "2026-11-22T09:01:00Z"), new Date("2026-11-22T09:10:00Z"))).toBe(false);
  });

  it("간격이 지나기 전에는 due가 아니다", () => {
    const schedule = { kind: "interval" as const, intervalMin: 30 };
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:29:59Z"))).toBe(false);
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:30:00Z"))).toBe(true);
  });

  it("1분 간격을 지원합니다", () => {
    const schedule = { kind: "interval" as const, intervalMin: 1 };
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:00:59Z"))).toBe(false);
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:01:00Z"))).toBe(true);
  });

  it("5분 간격을 지원합니다", () => {
    const schedule = { kind: "interval" as const, intervalMin: 5 };
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:04:59Z"))).toBe(false);
    expect(isDue(record(schedule, "2026-11-22T00:00:00Z"), new Date("2026-11-22T00:05:00Z"))).toBe(true);
  });

  it("자정을 넘는 방해 금지 시간에는 due가 아니다", () => {
    const schedule = {
      kind: "interval" as const,
      intervalMin: 15,
      quiet: { start: "23:00", end: "08:00" },
    };
    expect(isDue(record(schedule, "2026-11-21T12:00:00Z"), new Date("2026-11-21T15:30:00Z"))).toBe(false);
    expect(isDue(record(schedule, "2026-11-21T12:00:00Z"), new Date("2026-11-21T22:30:00Z"))).toBe(false); // KST 07:30
    expect(isDue(record(schedule, "2026-11-21T12:00:00Z"), new Date("2026-11-22T00:01:00Z"))).toBe(true);
  });

  it("마지막 조사가 전날이면 자정 이후 첫 일정이 due", () => {
    const schedule = { kind: "daily" as const, times: ["00:10"] };
    expect(isDue(record(schedule, "2026-11-21T14:59:00Z"), new Date("2026-11-21T15:11:00Z"))).toBe(true);
  });
});
