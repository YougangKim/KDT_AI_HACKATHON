import { afterEach, describe, expect, it, vi } from "vitest";
// 관찰 예약 테스트가 실제 Jev를 부르지 않게 한다
vi.mock("../ai/jev", () => ({ jevEnabled: () => Boolean(process.env.JEV_API_KEY), askJev: vi.fn(async () => null), judgeYes: vi.fn(async () => null) }));
import { evidenceInSource } from "../ai";
import { _resetObservation, observeEnabled, presentKeys, resetObserveBudget, scheduleObservation } from "../ai/target-judge";
import type { Condition, Opportunity } from "../types";
import { aiKey, applyAi } from "./index";
import { forClient, getEligibility, withEligibility } from "./util";

const RAW = "신청 자격: 만 19세~34세 청년으로, 공고일 현재 무주택세대구성원인 자. 대학(원) 재학생은 제외합니다.";

const opp = (raw = RAW): Opportunity =>
  withEligibility({ id: "t:1", domain: "housing", title: "청년 월세", org: "기관", region: [], summary: "", conditions: [], url: "https://example.go.kr", source: "t", isSample: false, fetchedAt: "2026-11-24T00:00:00Z" } as Opportunity, raw);

const cond = (attr: Condition["attr"], rawText: string, extra: Partial<Condition> = {}): Condition =>
  ({ attr, op: "eq", value: true, rawText, confidence: "high", ...extra }) as Condition;

describe("evidenceInSource", () => {
  it("공백·문장부호를 무시하고 원문 구절을 찾는다", () => {
    expect(evidenceInSource("무주택 세대구성원인 자", RAW)).toBe(true);
  });
  it("앞 12자가 맞으면 뒤를 바꿔 쓴 부분 인용도 인정한다", () => {
    expect(evidenceInSource("공고일 현재 무주택세대구성원에 해당하는 사람", RAW)).toBe(true);
  });
  it("구절 바로 뒤가 제외·불가면 근거로 인정하지 않는다", () => {
    expect(evidenceInSource("무주택세대구성원", "무주택세대구성원은 제외합니다")).toBe(false);
    expect(evidenceInSource("대학(원) 재학생", RAW)).toBe(false); // "재학생은 제외"
  });
  it("같은 구절이 여러 번 나오면 하나라도 긍정이면 인정", () => {
    expect(evidenceInSource("재직자", "재직자는 제외. 단, 중소기업 재직자 신청 가능")).toBe(true);
  });
  it("구절 안의 부정(조건 정의)은 그대로 인정", () => {
    expect(evidenceInSource("주택을 소유하지 않은 자", "세대원 전원이 주택을 소유하지 않은 자")).toBe(true);
  });
  it("원문에 없는 구절·빈 구절은 근거 없음", () => {
    expect(evidenceInSource("기초생활수급자만 신청 가능", RAW)).toBe(false);
    expect(evidenceInSource("", RAW)).toBe(false);
  });
});

describe("applyAi 근거 대조", () => {
  it("근거가 원문에 있는 AI 조건은 그대로(high)", () => {
    const out = applyAi(opp(), [cond("homeless", "무주택세대구성원인 자")]);
    expect(out.conditions).toContainEqual(expect.objectContaining({ attr: "homeless", confidence: "high", aiGenerated: true }));
  });
  it("근거 구절이 원문에 없으면 탈락 대신 확인 필요(low)", () => {
    const out = applyAi(opp(), [cond("welfare", "기초생활수급자 대상")]);
    expect(out.conditions).toContainEqual(expect.objectContaining({ attr: "welfare", confidence: "low" }));
  });
  it("규칙 조건과 같은 속성은 AI가 덮어쓰지 않는다(기존 동작 유지)", () => {
    const base = { ...opp(), conditions: [cond("homeless", "규칙")] };
    const out = applyAi(withEligibility(base, RAW), [cond("homeless", "다른 구절")]);
    expect(out.conditions.filter((c) => c.attr === "homeless")).toHaveLength(1);
  });
});

describe("자격요건 원문 저장", () => {
  it("객체를 복사해도 원문이 남고(공고 DB에 저장됨), 화면 응답에서는 빠진다", () => {
    const o = opp();
    expect(getEligibility({ ...o })).toBe(RAW);
    expect(forClient(o).eligibility).toBeUndefined();
    expect(JSON.parse(JSON.stringify(o)).eligibility).toBe(RAW);
  });
  it("길이 상한과 공백 정리", () => {
    expect(getEligibility(opp("가  나\n다".repeat(1000)))!.length).toBeLessThanOrEqual(2000);
    expect(getEligibility(opp("  "))).toBeUndefined();
  });
});

describe("AI 조건 메모리 캐시 키", () => {
  it("같은 공고라도 자격요건 원문이 바뀌면 키가 달라진다(헌 해석 재사용 방지)", () => {
    expect(aiKey(opp(RAW))).not.toBe(aiKey(opp(`${RAW} 추가 조건`)));
    expect(aiKey(opp(RAW))).toBe(aiKey(opp(RAW)));
  });
});

describe("Jev 관찰 모드", () => {
  it("관찰 상한은 수집 1회 전체에서 공유되고, 꺼져 있으면 예약하지 않는다", () => {
    delete process.env.JEV_OBSERVE;
    resetObserveBudget(2);
    expect(scheduleObservation("원문")).toBe(false);
    process.env.JEV_OBSERVE = "1";
    process.env.JEV_API_KEY = "test";
    resetObserveBudget(0);
    expect(scheduleObservation("원문")).toBe(false);
    resetObserveBudget(1);
    expect(scheduleObservation("")).toBe(false); // 빈 원문은 상한을 쓰지 않음
  });
  it("상한만큼만 예약하고, 같은 원문은 두 번 예약하지 않으며, 동시 수집이 상한을 깎지 않는다", async () => {
    process.env.JEV_OBSERVE = "1";
    process.env.JEV_API_KEY = "test";
    await _resetObservation();
    resetObserveBudget(2);
    expect(scheduleObservation("원문A")).toBe(true);
    expect(scheduleObservation("원문A")).toBe(false); // 중복
    resetObserveBudget(1); // 다른 수집이 시작돼도 남은 1건이 0으로 줄지 않음
    expect(scheduleObservation("원문B")).toBe(true);
    expect(scheduleObservation("원문C")).toBe(false); // 상한 초과
    await _resetObservation();
  });
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it("JEV_OBSERVE=1과 키가 모두 있어야 켜진다(기본 OFF)", () => {
    delete process.env.JEV_OBSERVE;
    process.env.JEV_API_KEY = "k";
    expect(observeEnabled()).toBe(false);
    process.env.JEV_OBSERVE = "1";
    expect(observeEnabled()).toBe(true);
    delete process.env.JEV_API_KEY;
    expect(observeEnabled()).toBe(false);
  });
  it("조건 → 비교용 키(나이·소득은 존재, 취업 상태는 값별)", () => {
    const keys = presentKeys([
      { attr: "age", value: 34 },
      { attr: "incomePct", value: 150 },
      { attr: "employment", value: ["student", "jobseeker"] },
      { attr: "homeless", value: true },
    ]);
    expect([...keys].sort()).toEqual(["hasAge", "hasIncome", "homeless", "jobseeker", "student"]);
  });
});
