import { describe, expect, test } from "vitest";
import { SHORT_ADDRESS_RE, workplaceValues } from "./workplace";
import { extractPlaceRules } from "./extract";
import { mapSeoulRecruit } from "../sources/seoul-recruit";
import type { Opportunity } from "../types";

const job = (summary: string, eligibility?: string): Opportunity => ({
  id: "j", domain: "job", title: "채용", org: "기관", region: [], summary, conditions: [], url: "https://example.com", source: "work24-recruit", isSample: false, fetchedAt: "2026-11-25T00:00:00Z", ...(eligibility ? { eligibility } : {}),
} as Opportunity);

describe("근무지 라벨·필드 파싱", () => {
  test.each([
    ["근무지: 서울특별시 강남구 테헤란로 123", "서울특별시 강남구 테헤란로 123"],
    ["근무지 : 서울 강남구", "서울 강남구"],
    ["근무지역 - 경기 성남시 분당구", "경기 성남시 분당구"],
    ["[근무장소] 부산광역시 해운대구 센텀로 10", "부산광역시 해운대구 센텀로 10"],
    ["근무 장소：대전 유성구", "대전 유성구"],
    ["근무지는 은평구 녹번동입니다.", "은평구 녹번동"],
    ["근무처 = 인천 남동구", "인천 남동구"],
  ])("%s", (text, value) => {
    expect(workplaceValues(text)).toEqual([value]);
  });

  test("라벨만 있는 줄은 다음 줄 값을 쓴다", () => {
    expect(workplaceValues("□ 근무장소\n ○ 서울특별시 중구 세종대로 110\n□ 근무시간")).toEqual(["서울특별시 중구 세종대로 110"]);
    expect(workplaceValues("<p>근무예정지</p><p>- 광주 북구</p>")).toEqual(["광주 북구"]);
  });

  test("같은 줄 라벨 앞 본사 주소는 버린다", () => {
    expect(workplaceValues("본사 전라남도 나주시 빛가람로 661, 근무지 서울특별시 중구 세종대로 110")).toEqual(["서울특별시 중구 세종대로 110"]);
  });

  test("근무지 라벨이 없으면 빈 목록", () => {
    expect(workplaceValues("본사 전라남도 나주시 빛가람로 661 / 정규직")).toEqual([]);
  });

  test("줄임 시·도 주소", () => {
    expect("서울 강남구 테헤란로 123".match(SHORT_ADDRESS_RE)?.[0]).toBe("서울 강남구 테헤란로 123");
    expect("서울시 중구".match(SHORT_ADDRESS_RE)?.[0]).toBe("서울시 중구");
    expect("강원".match(SHORT_ADDRESS_RE)).toBeNull();
  });

  test("채용 공고: 라벨 형태·줄임 주소·자격요건 원문에서도 근무지 추출", () => {
    expect(extractPlaceRules(job("정규직 / 근무지: 경기 수원시 팔달구"))).toEqual({ address: "경기 수원시 팔달구", place: null });
    expect(extractPlaceRules(job("정규직", "□ 근무장소\n○ 서울특별시 마포구 월드컵로 1"))).toEqual({ address: "서울특별시 마포구 월드컵로 1", place: null });
    // 시·도만 있는 근무지는 중심 좌표 핀을 만들지 않는다
    expect(extractPlaceRules(job("정규직 / 근무지 강원 / 1명"))).toBeNull();
  });

  test("서울시 채용: 본문의 근무장소 라벨을 요약에 남긴다", () => {
    const [o] = mapSeoulRecruit([{ BOARD_ID: 9, TITLE: "기간제 채용", DEADLINE_DATE: "20261205", CONTENTS: "1. 모집인원 1명<br>2. 근무장소 : 서울특별시 중구 덕수궁길 15<br>3. 근무시간 09~18" }], new Date("2026-11-25T00:00:00Z"));
    expect(o.summary).toContain("근무지 서울특별시 중구 덕수궁길 15");
    expect(extractPlaceRules(o)).toEqual({ address: "서울특별시 중구 덕수궁길 15", place: null });
  });
});

describe("근무지 라벨 오탐 방지", () => {
  test("근무지원금·비근무지역은 라벨이 아니다", () => {
    expect(workplaceValues("근무지원금 지급 / 비근무지역 제외")).toEqual([]);
  });
});
