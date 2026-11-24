import { describe, expect, it, vi } from "vitest";
import { allFacets, registerFacet } from "./facets";
import { RULE_FACETS } from "@/lib/ai/refinement-rules";

vi.stubEnv("AI_CACHE_DISABLE_FILE", "1");

describe("분류 칼럼 등록", () => {
  it("AI가 만든 새 질문은 칼럼으로 한 번만 등록되고, 기본 칼럼과 같은 질문은 등록하지 않는다", async () => {
    const q = { text: "어떤 업무 환경을 원하십니까?", why: "현장 업무와 사무 업무를 나눕니다.", options: [{ label: "현장", ids: ["a"], terms: ["현장"] }, { label: "사무", ids: ["b"], terms: ["사무"] }] };
    const f = await registerFacet(q, ["job"]);
    expect(f?.id).toMatch(/^q_/);
    expect(f?.domains).toEqual(["job"]);
    expect(await registerFacet(q, ["job"])).toBeNull();
    expect(await registerFacet({ ...q, text: RULE_FACETS[0].text }, ["job"])).toBeNull();
    expect((await allFacets()).map((x) => x.id)).toContain(f!.id);
  });
});
