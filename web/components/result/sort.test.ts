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
