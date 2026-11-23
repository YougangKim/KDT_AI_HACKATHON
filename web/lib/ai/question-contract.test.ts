import { describe, expect, it } from "vitest";
import { validateQuestion, type QuestionFacet } from "./question-contract";

const facets: QuestionFacet[] = [{ id: "need:eq:교육", text: "어떤 비용이 부담입니까?", options: [{ key: "0", label: "교육비", remaining: 4 }, { key: "1", label: "생활비", remaining: 6 }] }];
const valid = { id: facets[0].id, text: "현재 가장 줄이고 싶은 비용은 무엇입니까?", why: "교육비 지원과 생활비 지원을 구분합니다.", options: [{ key: "0", label: "배우는 데 드는 비용" }, { key: "1", label: "생활에 드는 비용" }] };
describe("생성 질문 검증", () => {
  it("실제 필터 축에 연결된 새 문장을 허용합니다", () => expect(validateQuestion(valid, facets, [], 10)).toEqual(valid));
  it("이미 답한 질문을 거절합니다", () => expect(validateQuestion(valid, facets, [{ text: valid.text }], 10)).toBeNull());
  it("만든 필터 키·빠진 선택지·중복 선택지를 거절합니다", () => {
    expect(validateQuestion({ ...valid, id: "invented" }, facets, [], 10)).toBeNull();
    expect(validateQuestion({ ...valid, options: valid.options.slice(0, 1) }, facets, [], 10)).toBeNull();
    expect(validateQuestion({ ...valid, options: [valid.options[0], valid.options[0]] }, facets, [], 10)).toBeNull();
  });
  it("어느 선택지도 후보를 좁히지 못하면 거절합니다", () => {
    expect(validateQuestion(valid, [{ ...facets[0], options: facets[0].options.map((o) => ({ ...o, remaining: 10 })) }], [], 10)).toBeNull();
  });
});
