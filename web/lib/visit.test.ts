import { describe, expect, it } from "vitest";
import { touchVisit } from "./visit";

function memStorage(init: Record<string, string>): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}
const DAY = 24 * 60 * 60 * 1000;

describe("기기 방문 기록·14일 미접속 삭제", () => {
  it("14일 안에 다시 오면 지난 결과를 유지", () => {
    const s = memStorage({ lastVisitAt: String(Date.now() - 13 * DAY), lastResult: "{}", watch: "{}" });
    expect(touchVisit(Date.now(), s)).toBe(false);
    expect(s.getItem("lastResult")).toBe("{}");
  });
  it("14일 넘게 안 오면 결과·조건·알림 기록·신청 준비 체크를 지운다", () => {
    const s = memStorage({ lastVisitAt: String(Date.now() - 15 * DAY), lastResult: "{}", watch: "{}", alertLog: "[]", "prep:a": "{}", other: "1" });
    expect(touchVisit(Date.now(), s)).toBe(true);
    expect(s.getItem("lastResult")).toBeNull();
    expect(s.getItem("watch")).toBeNull();
    expect(s.getItem("prep:a")).toBeNull();
    expect(s.getItem("other")).toBe("1");
  });
});
