import { beforeEach, describe, expect, it } from "vitest";
import type { AnswerRecord, Match, Opportunity, Watch } from "@/lib/types";
import {
  addAlerts,
  buildWatch,
  collectAlerts,
  ddayLabel,
  daysLeft,
  findDeadlineSoon,
  findNew,
  loadAlertLog,
  loadWatch,
  markSeen,
  saveWatch,
  unreadCount,
} from "./index";

const NOW = new Date("2026-11-21T10:00:00");

function opp(id: string, extra: Partial<Opportunity> = {}): Opportunity {
  return {
    id,
    domain: "housing",
    title: id,
    org: "기관",
    region: [],
    summary: "",
    conditions: [],
    url: "https://example.com",
    source: "sample",
    isSample: true,
    fetchedAt: NOW.toISOString(),
    ...extra,
  };
}

const noHomeless: AnswerRecord = {
  question: { id: "homeless:eq:true", attr: "homeless", op: "eq", value: true, text: "무주택?" },
  answer: "no",
};

function watch(extra: Partial<Watch> = {}): Watch {
  return { createdAt: NOW.toISOString(), answers: [], domains: ["housing"], seenIds: [], ...extra };
}

beforeEach(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
});

describe("D-day", () => {
  it("남은 날 수와 라벨", () => {
    expect(daysLeft("2026-11-24", NOW)).toBe(3);
    expect(ddayLabel("2026-11-24", NOW)).toBe("D-3");
    expect(ddayLabel("2026-11-21", NOW)).toBe("D-day");
    expect(ddayLabel("2026-11-20", NOW)).toBe("마감");
    expect(ddayLabel(undefined, NOW)).toBe("상시");
  });
});

describe("findNew", () => {
  it("본 공고·다른 분야·마감 지난 공고는 제외", () => {
    const pool = [
      opp("seen"),
      opp("new"),
      opp("job", { domain: "job" }),
      opp("expired", { applyEnd: "2026-11-01" }),
    ];
    expect(findNew(watch({ seenIds: ["seen"] }), pool, NOW).map((o) => o.id)).toEqual(["new"]);
  });

  it("'아니오'라고 답한 조건이 있는 공고는 제외", () => {
    const pool = [
      opp("needsHomeless", {
        conditions: [{ attr: "homeless", op: "eq", value: true, rawText: "무주택자", confidence: "high" }],
      }),
      opp("free"),
    ];
    expect(findNew(watch({ answers: [noHomeless] }), pool, NOW).map((o) => o.id)).toEqual(["free"]);
  });

  it("분야가 비어 있으면 전체 분야", () => {
    expect(findNew(watch({ domains: [] }), [opp("a", { domain: "exam" })], NOW)).toHaveLength(1);
  });
});

describe("마감 임박", () => {
  it("D-3 이내만", () => {
    const pool = [opp("d3", { applyEnd: "2026-11-24" }), opp("d4", { applyEnd: "2026-11-25" }), opp("always")];
    expect(findDeadlineSoon(watch(), pool, NOW).map((o) => o.id)).toEqual(["d3"]);
  });
});

describe("collectAlerts", () => {
  it("이미 기록된 알림은 다시 만들지 않는다", () => {
    const pool = [opp("x", { applyEnd: "2026-11-22" })];
    const first = collectAlerts(watch(), pool, [], NOW);
    expect(first.map((a) => a.kind).sort()).toEqual(["deadline", "new"]);
    expect(collectAlerts(watch(), pool, first, NOW)).toEqual([]);
  });
});

describe("저장소", () => {
  it("saveWatch/loadWatch/markSeen", () => {
    expect(loadWatch()).toBeNull();
    const m: Match = { opportunity: opp("m1"), status: "eligible", reasons: [], unknowns: [] };
    const w = buildWatch([noHomeless], [m], NOW);
    expect(w.domains).toEqual([]); // 고른 분야가 없으면 전체를 감시
    expect(w.seenIds).toEqual(["m1"]);
    saveWatch(w);
    expect(loadWatch()).toEqual(w);
    markSeen(w, ["m2", "m1"]);
    expect(loadWatch()?.seenIds).toEqual(["m1", "m2"]);
  });

  it("감시 분야는 지금 결과가 아니라 고른 분야(지금 0건인 분야도 포함)", () => {
    const interest = (v: string) => ({ question: { id: `interest:eq:${v}`, attr: "interest" as const, op: "eq" as const, value: v, text: "" }, answer: "yes" as const });
    const m: Match = { opportunity: opp("m1"), status: "eligible", reasons: [], unknowns: [] };
    const w = buildWatch([interest("housing"), interest("parttime")], [m], NOW);
    expect(w.domains.sort()).toEqual(["housing", "parttime"]);
  });

  it("알림 기록과 안 읽은 수", () => {
    addAlerts(collectAlerts(watch(), [opp("y")], [], NOW));
    expect(loadAlertLog()).toHaveLength(1);
    expect(unreadCount()).toBe(1);
  });
});
