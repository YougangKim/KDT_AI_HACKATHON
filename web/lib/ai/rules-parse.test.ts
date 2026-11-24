// 생성형 AI 대신 원문 파싱으로 뽑는 자격조건(부정·예외 문구, 신혼·수급자·청약통장·경력·학력)
import { describe, expect, it } from "vitest";
import { structureConditionsRules } from "./rules";

const attrs = (t: string) => structureConditionsRules(t).map((c) => c.attr);
const find = (t: string, attr: string) => structureConditionsRules(t).find((c) => c.attr === attr);

describe("부정·예외 문구", () => {
  it("'재학생은 제외'는 대학생 대상 조건이 아니다", () => {
    expect(find("만 19~34세 미취업 청년. 대학(원) 재학생은 제외", "employment")?.value).toEqual(["jobseeker"]);
  });
  it("'무주택 요건 없음'은 무주택 조건을 만들지 않는다", () => {
    expect(attrs("무주택 요건 없음, 누구나 신청")).not.toContain("homeless");
  });
  it("한 곳이라도 대상으로 나오면 조건으로 본다", () => {
    expect(attrs("재직자는 제외하되, 중소기업 재직자 중 저소득층은 신청 가능")).toContain("employment");
  });
  it("조사·'여부'가 끼어도 부정으로 본다", () => {
    expect(find("미취업 청년(재학생을 제외)", "employment")?.value).toEqual(["jobseeker"]);
    expect(attrs("무주택 여부 무관")).not.toContain("homeless");
    expect(attrs("신혼부부가 아닌 자")).not.toContain("married");
    expect(find("미취업 청년, 대학원 재학생은 제외", "employment")?.value).toEqual(["jobseeker"]);
    expect(find("대학 휴학생 가능", "employment")?.value).toEqual(["student"]);
  });
  it("조건 정의 안의 부정('소유하지 않은')은 그대로 인정", () => {
    expect(attrs("세대원 전원이 주택을 소유하지 않은 무주택세대구성원")).toContain("homeless");
  });
});

describe("AI 해석에 맡기던 대상 조건을 원문 단어로", () => {
  it("신혼부부·예비신혼·혼인 N년 이내", () => {
    expect(find("혼인 7년 이내 신혼부부", "married")).toMatchObject({ value: true, confidence: "low" });
    expect(attrs("신혼부부 제외")).not.toContain("married");
  });
  it("수급자·차상위", () => {
    expect(find("기초생활수급자 및 차상위계층 우선", "welfare")).toMatchObject({ value: true, confidence: "low" });
  });
  it("청약통장", () => {
    expect(attrs("주택청약종합저축 가입자")).toContain("subscription");
  });
  it("경력: '경력 3년 이상'은 조건, 신입·경력무관·경력자 우대는 아님", () => {
    expect(attrs("관련 분야 경력 3년 이상")).toContain("experienced");
    expect(attrs("신입 및 경력 3년 이상")).not.toContain("experienced");
    expect(attrs("경력자 우대")).not.toContain("experienced");
    // 문서 다른 곳의 "신입"은 경력 필수 조건을 지우지 않는다(바로 앞 동시 모집만)
    expect(attrs("신입사원 교육 운영. 지원자격: 관련 분야 경력 3년 이상")).toContain("experienced");
  });
  it("학력: 단계로 바꾸고, 학력 무관이면 만들지 않음", () => {
    expect(find("4년제 대학교 졸업자", "education")).toMatchObject({ op: "gte", value: 3 });
    expect(find("고등학교 졸업 이상", "education")?.value).toBe(1);
    expect(attrs("학력 무관")).not.toContain("education");
    expect(find("박사 학위 소지자", "education")?.value).toBe(5);
    expect(find("석사 이상", "education")?.value).toBe(4);
  });
});

describe("분야에 맞는 조건만 붙인다(buildConditions)", () => {
  it("신혼·청약통장은 주거에만, 경력·학력은 채용·알바·훈련에만", async () => {
    const { buildConditions } = await import("../sources/util");
    const text = "신혼부부, 주택청약종합저축 가입자, 4년제 대학교 졸업자, 경력 3년 이상";
    const of = (d: "housing" | "benefit" | "job") => buildConditions(d, [], text).map((c) => c.attr);
    expect(of("housing")).toEqual(expect.arrayContaining(["married", "subscription"]));
    expect(of("housing")).not.toContain("education");
    expect(of("benefit")).not.toEqual(expect.arrayContaining(["married"]));
    expect(of("benefit")).not.toContain("experienced");
    expect(of("job")).toEqual(expect.arrayContaining(["education", "experienced"]));
  });
});

describe("국비훈련 주소", () => {
  it("API의 훈련기관 주소를 장소로 저장하고, 없으면 비워 둔다", async () => {
    const { mapWork24Training } = await import("../sources/work24-training");
    const row = { trprId: "A", trprDegr: "1", title: "과정", subTitle: "기관", traStartDate: "2026-12-15", trainTarget: "", titleLink: "https://w.kr" };
    const now = new Date("2026-11-24T00:00:00Z");
    expect(mapWork24Training({ srchList: [{ ...row, address: "서울 강남구 테헤란로 1" }] }, now)[0].place).toBe("서울 강남구 테헤란로 1");
    expect(mapWork24Training({ srchList: [{ ...row, address: "" }] }, now)[0].place).toBeUndefined();
  });
});
