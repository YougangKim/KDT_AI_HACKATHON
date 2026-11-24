import { afterEach, describe, expect, it, vi } from "vitest";
import { answersToTags, attachTags, carryTags, FIELD_TAG, missingQuestions, needsTags, UNSURE } from "./classify";
import { inferJobConditions } from "./index";
import { RULE_FACETS, ruleRefinement, type Facet } from "../ai/refinement-rules";
import { attachRefinement } from "../ai/refinement";
import { OPEN_FIELD } from "./field";
import type { Opportunity } from "../types";

const opp = (id: string, domain: Opportunity["domain"], title: string, tags?: Record<string, string>): Opportunity =>
  ({ id, domain, title, org: "", region: [], summary: "", conditions: [], url: "", source: "t", isSample: false, fetchedAt: "", tags }) as Opportunity;
const NEW: Facet = { id: "q_new", domains: ["job"], text: "어떤 업무를 원하십니까?", why: "업무로 나눕니다.", options: [{ label: "현장", terms: ["현장"] }, { label: "사무", terms: ["사무"] }] };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("공고 분류 칼럼(Jev)", () => {
  it("분야별로 아직 분류하지 않은 칼럼만 묻는다", () => {
    expect(Object.keys(missingQuestions({ domain: "job" }, RULE_FACETS))).toEqual([FIELD_TAG, "employ", "orgType", "event"]);
    expect(Object.keys(missingQuestions({ domain: "benefit" }, RULE_FACETS))).toEqual(["need", "supportForm", "benefitArea"]);
    expect(Object.keys(missingQuestions({ domain: "exam" }, RULE_FACETS))).toEqual([]);
    // 이미 분류한 칼럼(확신 못 함 "?" 포함)은 다시 묻지 않고, 새 칼럼만 묻는다
    const done = { domain: "job" as const, tags: { field: UNSURE, employ: "정규직", orgType: "", event: "개별 채용 공고" } };
    expect(Object.keys(missingQuestions(done, RULE_FACETS))).toEqual([]);
    expect(Object.keys(missingQuestions(done, [...RULE_FACETS, NEW]))).toEqual(["q_new"]);
  });

  it("확신한 답은 선택지, 확신하는 해당 없음은 빈 값, 확신 못 함은 ?", () => {
    const tags = answersToTags(RULE_FACETS, {
      field: { type: "choice", choice: "f0", confidence: 0.92 },
      employ: { type: "choice", choice: "o2", confidence: 0.9 },
      orgType: { type: "choice", choice: "o0", confidence: 0.5 },
      event: { type: "choice", choice: "none", confidence: 0.95 },
    });
    expect(tags).toEqual({ field: "정보통신", employ: "인턴·체험형", orgType: UNSURE, event: "" });
    expect(answersToTags(RULE_FACETS, { field: { type: "choice", choice: "open", confidence: 0.9 } })).toEqual({ field: OPEN_FIELD });
    expect(answersToTags(RULE_FACETS, { field: { type: "choice", choice: "none", confidence: 0.99 } })).toEqual({ field: UNSURE });
  });

  it("키가 없으면 묻지 않고, 있으면 빠진 칼럼만 한 요청에 묶어 물어 기존 칼럼에 더한다", async () => {
    const items = [opp("a", "job", "보안관제 신입 채용")];
    expect((await attachTags(items, RULE_FACETS)).items).toBe(items);
    vi.stubEnv("JEV_API_KEY", "k");
    const f = vi.fn(async () => new Response(JSON.stringify({ answers: { q_new: { type: "choice", choice: "o1", confidence: 0.9 } } })));
    vi.stubGlobal("fetch", f);
    const before = opp("b", "job", "정보보안 채용", { field: "정보통신", employ: "정규직", orgType: "", event: "" });
    const { items: [after], asked } = await attachTags([before, opp("c", "housing", "x", { housingKind: "분양" })], [...RULE_FACETS, NEW]);
    expect(asked).toBe(1);
    expect(Object.keys(JSON.parse(String(((f.mock.calls[0] as unknown[])[1] as RequestInit).body)).questions)).toEqual(["q_new"]);
    expect(after.tags).toEqual({ field: "정보통신", employ: "정규직", orgType: "", event: "", q_new: "사무" });
    expect(needsTags(after, [...RULE_FACETS, NEW])).toBe(false);
  });

  it("다시 수집한 같은 공고는 이전 DB 칼럼을 옮기고, 제목이 바뀌면 다시 분류 대상", () => {
    const prev = [opp("a", "job", "제목", { field: "기계" }), opp("b", "job", "옛 제목", { field: "건설" }), opp("c", "job", "같은 제목", { field: "건설" })];
    const changedSummary = { ...opp("c", "job", "같은 제목"), summary: "요약이 바뀜" };
    const [a, b, c] = carryTags([opp("a", "job", "제목"), opp("b", "job", "새 제목"), changedSummary], prev);
    expect(a.tags).toEqual({ field: "기계" });
    expect(b.tags).toBeUndefined();
    expect(c.tags).toBeUndefined(); // 제목이 같아도 요약이 바뀌면 다시 분류
  });

  it("시간 제한이 지나면 새 요청을 보내지 않는다", async () => {
    vi.stubEnv("JEV_API_KEY", "k");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { asked } = await attachTags([opp("a", "job", "x")], RULE_FACETS, { deadline: Date.now() - 1 });
    expect(asked).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("직무 판별은 확신한 Jev 칼럼을 키워드보다 우선하고, ?면 키워드로", () => {
    const o = inferJobConditions(opp("c", "job", "제약 생산직 채용", { field: "화학·바이오" }));
    expect(o.conditions.find((c) => c.attr === "field")?.value).toEqual(["화학·바이오"]);
    const open = inferJobConditions(opp("d", "job", "2026 신입 공채", { field: OPEN_FIELD }));
    expect(open.conditions.find((c) => c.attr === "field")?.value).toEqual([OPEN_FIELD]);
    const unsure = inferJobConditions(opp("e", "job", "보안관제 채용", { field: UNSURE }));
    expect(unsure.conditions.find((c) => c.attr === "field")?.value).toEqual(["정보통신"]);
  });

  it("칼럼으로 질문을 만들고, 적용할 때 표본 밖 공고도 칼럼 값으로 나눈다", () => {
    const pool = [
      opp("1", "job", "가", { employ: "정규직" }), opp("2", "job", "나", { employ: "정규직" }),
      opp("3", "job", "다", { employ: "인턴·체험형" }), opp("4", "job", "라", { employ: "인턴·체험형" }),
      opp("5", "job", "마 정규직", { employ: "" }),
    ];
    const r = ruleRefinement(pool, [], { tagsOnly: true })!;
    expect(r.text).toBe("어떤 고용 형태를 원하십니까?");
    expect(r.facet).toBe("employ");
    expect(r.options.map((o) => [o.label, o.ids])).toEqual([["정규직", ["1", "2"]], ["인턴·체험형", ["3", "4"]]]);
    const outside = attachRefinement([opp("9", "job", "바", { employ: "인턴·체험형" }), opp("8", "job", "사 정규직 채용")], r);
    expect(outside[0].conditions[0].value).toEqual(["어떤 고용 형태를 원하십니까? — 인턴·체험형"]);
    expect(outside[1].conditions[0].value).toEqual(["어떤 고용 형태를 원하십니까? — 정규직"]); // 칼럼 없으면 원문 단어
    expect(ruleRefinement(pool.map((o) => ({ ...o, tags: undefined })), [], { tagsOnly: true })).toBeNull();
  });

  it("새로 등록된 칼럼도 질문에 쓴다", () => {
    const pool = ["1", "2", "3", "4"].map((id, i) => opp(id, "job", id, { q_new: i < 2 ? "현장" : "사무", employ: "정규직" }));
    expect(ruleRefinement(pool, [], { tagsOnly: true, facets: [...RULE_FACETS, NEW] })?.facet).toBe("q_new");
  });
});
