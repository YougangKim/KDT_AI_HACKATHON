import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import { sortMatches } from "./sort";

const m = (id: string, summary: string, region: string[] = []): Match => ({
  opportunity: { id, domain: "job", title: id, org: "", region, summary, conditions: [], url: "", source: "t", isSample: false, fetchedAt: "", applyEnd: "2099-12-31" },
  status: "eligible",
  reasons: [],
  unknowns: [],
});

describe("결과 정렬", () => {
  it("근무지가 다른 지역인 전국 공고만 뒤로, 근무지 정보 없는 전국 공고는 불이익 없음", () => {
    const out = sortMatches([m("far", "정규직 / 근무지 전북"), m("none", "정규직"), m("near", "정규직 / 근무지 서울")], "서울");
    expect(out.map((x) => x.opportunity.id)).toEqual(["none", "near", "far"]);
  });
  it("지역을 모르면 순서를 바꾸지 않는다", () => {
    const out = sortMatches([m("far", "근무지 전북"), m("near", "근무지 서울")], null);
    expect(out.map((x) => x.opportunity.id)).toEqual(["far", "near"]);
  });
});
