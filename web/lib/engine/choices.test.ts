import { describe, expect, it } from "vitest";
import { INCOME_THRESHOLDS } from "./choices";

describe("선택지 범위", () => {
  it("소득 선택지는 기준중위소득 100% 이하 경계만 사용한다", () => {
    expect(INCOME_THRESHOLDS).toEqual([50, 60, 80, 100]);
    expect(INCOME_THRESHOLDS.every((value) => value <= 100)).toBe(true);
    expect(INCOME_THRESHOLDS).not.toContain(150);
  });
});
