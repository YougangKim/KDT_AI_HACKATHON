import { describe, expect, it } from "vitest";
import type { Opportunity } from "../types";
import { inferRegion } from "./index";
import { regionsOfToken } from "./sigungu";

const opp = (title: string, extra: Partial<Opportunity> = {}): Opportunity =>
  ({ id: title, title, org: "", domain: "benefit", region: [], conditions: [], summary: "", url: "https://x", source: "gov24", ...extra }) as Opportunity;

describe("시·군 이름으로 지역 판별", () => {
  it("시·군, 시·도 기관, 공식 명칭 낱말", () => {
    expect(regionsOfToken("광양시")).toEqual(["전남"]);
    expect(regionsOfToken("서산시청")).toEqual(["충남"]);
    expect(regionsOfToken("충남도립대학교")).toEqual(["충남"]);
    expect(regionsOfToken("제주특별자치도청")).toEqual(["제주"]);
    expect(regionsOfToken("전남광주통합특별시교육청")).toEqual(["전남", "광주"]);
    expect(regionsOfToken("전남개발공사")).toEqual(["전남"]);
    expect(regionsOfToken("도시")).toEqual([]);
    expect(regionsOfToken("서울대학교")).toEqual([]);
  });
  it("기관명이 시·군이면 그 지역 공고로 본다", () => {
    expect(inferRegion(opp("신혼부부 청년 주택 전세자금 대출이자 지원사업", { org: "전남광주통합특별시 여수시 청년인구정책관" })).region).toEqual(["전남", "광주"]);
    expect(inferRegion(opp("대학생 생활용품 구입비 지원", { org: "충청남도 서산시" })).region).toEqual(["충남"]);
    expect(inferRegion(opp("일하는 청년 보금자리 지원 사업", { domain: "housing", org: "제주특별자치도청" })).region).toEqual(["제주"]);
  });
  it("국비 과정은 훈련 장소, 채용은 제목만", () => {
    expect(inferRegion(opp("IT 개발자를 위한 C언어 입문", { domain: "training", org: "학원", summary: "국민내일배움카드(일반) / 훈련장소 경기 / 개강" })).region).toEqual(["경기"]);
    expect(inferRegion(opp("신입 사원 채용", { domain: "job", org: "전남 여수시 공사" })).region).toEqual([]);
  });
  it("전국 기관·동명 회사·온라인 과정·전국 표기는 지역을 붙이지 않는다", () => {
    expect(inferRegion(opp("청년 전세임대 입주자 모집", { domain: "housing", org: "한국토지주택공사" })).region).toEqual([]);
    expect(inferRegion(opp("청년 인턴 지원", { org: "(주)이천시스템" })).region).toEqual([]);
    expect(inferRegion(opp("광양시멘트 장학 지원", { org: "광양시멘트" })).region).toEqual([]);
    expect(inferRegion(opp("파이썬 기초", { domain: "training", org: "학원", summary: "훈련장소 온라인 / 개강", geo: { lat: 0, lng: 0, precision: "approx", address: "서울 강남구" } } as Partial<Opportunity>)).region).toEqual([]);
    expect(inferRegion(opp("직업상담사 2급 필기", { domain: "training", org: "에듀윌원격국비교육원", summary: "훈련장소 서울 / 개강" })).region).toEqual([]);
    expect(inferRegion(opp("전국 청년 대상 창업 지원", { org: "충청남도 천안시" })).region).toEqual([]);
  });
  it("서로 다른 시·도가 섞이면 전국으로 둔다", () => {
    expect(inferRegion(opp("천안시·청주시 청년 교류", {})).region).toEqual([]);
  });
});
