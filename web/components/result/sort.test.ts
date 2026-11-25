import { describe, expect, it } from "vitest";
import type { Match, Opportunity } from "@/lib/types";
import { interleaveByDomain } from "./sort";

const m = (id: string, domain: Opportunity["domain"], status: Match["status"] = "eligible"): Match =>
  ({ opportunity: { id, domain } as Opportunity, status, reasons: [], unknowns: [] }) as Match;

describe("전체 탭 분야 섞기", () => {
  it("지원금이 많아도 상위 3개에 고른 분야가 모두 보인다", () => {
    const list = [...Array.from({ length: 50 }, (_, i) => m(`b${i}`, "benefit")), m("j1", "job"), m("h1", "housing")];
    const top = interleaveByDomain(list).slice(0, 3).map((x) => x.opportunity.domain);
    expect(new Set(top)).toEqual(new Set(["benefit", "job", "housing"]));
  });
  it("자격 확인 상태가 달라도 다른 분야를 첫 페이지에서 숨기지 않는다", () => {
    const list = [m("b1", "benefit"), m("j1", "job", "needs_check"), m("b2", "benefit")];
    expect(interleaveByDomain(list).map((x) => x.opportunity.id)).toEqual(["b1", "j1", "b2"]);
  });
});

import { applySortMode } from "./sort";
describe("정렬 방식", () => {
  const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const mk = (id: string, end?: string, start?: string): Match =>
    ({ opportunity: { id, domain: "job", applyEnd: end, applyStart: start } as Opportunity, status: "eligible", reasons: [], unknowns: [] }) as Match;
  const list = [mk("soon", day(2), day(-20)), mk("roomy-new", day(30), day(-1)), mk("roomy-old", day(40), day(-30)), mk("always")];
  it("마감 임박순: 가까운 마감 먼저, 상시는 뒤", () => {
    expect(applySortMode(list, "deadline").map((m) => m.opportunity.id)).toEqual(["soon", "roomy-new", "roomy-old", "always"]);
  });
  it("기한 넉넉한 최신순: 14일 이상 남은 공고를 최근 시작 순으로, 임박 공고는 뒤", () => {
    const ids = applySortMode(list, "roomy").map((m) => m.opportunity.id);
    expect(ids.indexOf("roomy-new")).toBeLessThan(ids.indexOf("roomy-old"));
    expect(ids.at(-1)).toBe("soon");
  });
});

import { restrictedTarget } from "./sort";
describe("특정 대상 제한 공고", () => {
  it("장애인·보훈 제한 채용은 표시, 장애인 기관의 일반 채용은 아님", () => {
    expect(restrictedTarget("해양환경공단 체험형 청년인턴(장애인 제한) 채용 공고")).toBe(true);
    expect(restrictedTarget("부산항만공사 기간제 직원(장애인 바리스타) 채용 공고")).toBe(true);
    expect(restrictedTarget("[보훈특별채용] 2026년 하반기 채용형 청년인턴")).toBe(true);
    expect(restrictedTarget("장애인복지관 사회복지사 채용")).toBe(false);
    expect(restrictedTarget("국악방송 체험형 인턴(장애인) 채용 공고")).toBe(true);
    expect(restrictedTarget("[한국전력국제원자력대학원대학교] 기간제근로자 채용 (휴직대체 및 제한경쟁_장애인)")).toBe(true);
    expect(restrictedTarget("㈜강원랜드 2026년 2차 서비스지원직(보훈) 채용 공고")).toBe(true);
    expect(restrictedTarget("[광주보훈병원] 응급실 전담의, 전문의(외과) 채용 공고")).toBe(false);
    expect(restrictedTarget("[한국장애인고용공단 대전직업능력개발원] 특정업무직(운전원) 채용")).toBe(false);
    expect(restrictedTarget("한국동서발전(주) 2027년 상반기 신입직원(대졸수준(일반/보훈) 및 고졸) 선발")).toBe(false);
    expect(restrictedTarget("장애인 면학 장학금", "benefit")).toBe(true);
    expect(restrictedTarget("청년 월세 지원", "benefit")).toBe(false);
  });
});
