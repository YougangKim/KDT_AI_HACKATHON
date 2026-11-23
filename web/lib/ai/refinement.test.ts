import { describe, it, expect } from "vitest";
import { attachRefinement, refinementContext, refinementValue, validateRefinement } from "./refinement";
import { applyAnswer, getMatches, startGame } from "../engine";
import type { Opportunity, Question } from "../types";

const evidence = [
  { id: "a", title: "월세 지원", summary: "월세 부담", domain: "benefit" },
  { id: "b", title: "전세 대출", summary: "보증금 이자", domain: "benefit" },
  { id: "c", title: "교육비 지원", summary: "자격증 응시료", domain: "benefit" },
  { id: "d", title: "청년 지원", summary: "상세 내용 확인", domain: "benefit" },
];
const generated = { text: "현재 줄이고 싶은 지출은 무엇입니까?", why: "남은 공고의 지원 항목을 비교합니다.", options: [
  { label: "주거 비용", terms: ["월세", "보증금"] }, { label: "학습 비용", terms: ["교육비"] },
] };
describe("남은 원문에서 새로운 질문 생성", () => {
  it("대량 공고와 긴 이력도 모델 입력 예산 안에 넣고 분야를 유지합니다", () => {
    const large = Array.from({length:240},(_,i)=>({id:String(i),title:`공고${i} ${"내용".repeat(80)}`,summary:"설명".repeat(120),domain:i%2?"job":"benefit"}));
    const input = refinementContext(large,Array.from({length:300},()=>({text:"질문".repeat(100),answer:"yes"})));
    expect(JSON.stringify(input).length).toBeLessThan(5300);
    expect(input.evidence.length).toBeLessThanOrEqual(24);
    expect(new Set(input.evidence.map((e)=>e.domain)).size).toBe(2);
  });
  it("표본 밖 공고에도 생성된 원문 구절을 적용합니다", () => {
    const q = validateRefinement(generated,evidence,[])!;
    const pool: Opportunity[] = [{id:"outside",title:"다른 지역 월세 지원",summary:"",domain:"benefit",org:"",region:[],conditions:[],url:"",source:"test",isSample:false,fetchedAt:""}];
    expect(attachRefinement(pool,q)[0].conditions[0].value).toContain(refinementValue(q,"주거 비용"));
  });
  it("고정 필터 목록 없이 새 질문과 원문 근거를 검증합니다", () => {
    const q = validateRefinement(generated, evidence, []);
    expect(q?.options.map((o) => o.ids)).toEqual([["a", "b"], ["c"]]);
  });
  it("원문에 없는 선택지와 후보 감소 없는 선택지를 거부합니다", () => {
    expect(validateRefinement({ ...generated, options: [generated.options[0], { label: "없는 항목", terms: ["없는구절"] }] }, evidence, [])).toBeNull();
    expect(validateRefinement({ ...generated, options: [{ label: "모든항목", terms: ["월세", "전세", "교육비"] }, generated.options[1]] }, evidence, [])).toBeNull();
  });
  it("이전에 답한 질문과 해요체를 거부합니다", () => {
    expect(validateRefinement(generated, evidence, [{ text: generated.text + " — 주거 비용" }])).toBeNull();
    expect(validateRefinement({ ...generated, text: "어떤 지출을 줄이고 싶나요?" }, evidence, [])).toBeNull();
  });
  it("선택하면 실제 후보를 줄이고 미분류 공고는 보존합니다", () => {
    const q = validateRefinement(generated, evidence, [])!;
    const pool: Opportunity[] = evidence.map((e) => ({ ...e, domain: "benefit", org: "기관", region: [], conditions: [], url: "https://example.org", source: "fixture", isSample: false, fetchedAt: "2026-11-23" }));
    const initial = startGame(attachRefinement(pool, q));
    const questions: Question[] = q.options.map((o) => ({ id: `topic:eq:${refinementValue(q,o.label)}`,attr:"topic",op:"eq",value:refinementValue(q,o.label),text:q.text + " — " + o.label }));
    const selected = questions.reduce((s, question, i) => applyAnswer(s, question, i === 0 ? "yes" : "no"), initial);
    expect(getMatches(selected).map((m) => m.opportunity.id).sort()).toEqual(["a", "b", "d"]);
    const unknown = questions.reduce((s, question) => applyAnswer(s,question,"unknown"),initial);
    expect(getMatches(unknown)).toHaveLength(4);
    expect(pool.every((o) => o.conditions.length === 0)).toBe(true);
  });
});
