import { describe, expect, it } from "vitest";
import { getMatches } from "../engine";
import type { Opportunity, Question } from "../types";
import { inferRegion } from "./index";

const opp = (id: string, title: string, extra: Partial<Opportunity> = {}): Opportunity => ({
  id, domain: "benefit", title, org: "", region: [], summary: "", url: "", source: "gov24", isSample: false, fetchedAt: "",
  conditions: [{ attr: "interest", op: "eq", value: "benefit", rawText: "", confidence: "high" }], ...extra,
});
const seoul: Question = { id: "region:eq:서울", attr: "region", op: "eq", value: "서울", text: "지금 서울에 살고 있습니까?" };

describe("지역 필터", () => {
  it("서울을 고르면 부산 공고는 빠지고 전국 공고는 남는다", () => {
    const pool = [
      opp("busan", "부산 청년 월세 지원", { region: ["부산"], conditions: [{ attr: "region", op: "in", value: ["부산"], rawText: "대상 지역: 부산", confidence: "high" }] }),
      opp("seoul", "서울 청년수당", { region: ["서울"], conditions: [{ attr: "region", op: "in", value: ["서울"], rawText: "대상 지역: 서울", confidence: "high" }] }),
      opp("all", "청년도약계좌"),
    ];
    const ids = getMatches({ pool, answers: [{ question: seoul, answer: "yes" }] }).map((m) => m.opportunity.id).sort();
    expect(ids).toEqual(["all", "seoul"]);
  });

  it("지역이 비어 있으면 제목·기관명으로 판별해 다른 지역 공고를 거른다", () => {
    const busan = inferRegion(opp("b", "2026 부산광역시 청년 전세자금 이자 지원"));
    expect(busan.region).toEqual(["부산"]);
    expect(getMatches({ pool: [busan], answers: [{ question: seoul, answer: "yes" }] })).toHaveLength(0);
  });

  it("고유명사 속 지명(서울대학교)이나 시·도 2개 이상은 전국으로 둔다", () => {
    expect(inferRegion(opp("u", "서울대학교 장학금")).region).toEqual([]);
    expect(inferRegion(opp("m", "서울 부산 청년 교류 지원")).region).toEqual([]);
  });

  it("주거 공고는 카카오가 찾은 단지 주소로 판별한다", () => {
    const o = inferRegion(opp("h", "행복주택 예비입주자 모집", { domain: "housing", geo: { lat: 0, lng: 0, precision: "approx", address: "경기 수원시 권선구 당수동" } }));
    expect(o.region).toEqual(["경기"]);
  });
});
