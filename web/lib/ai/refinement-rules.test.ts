import { describe, expect, it } from "vitest";
import { ruleRefinement } from "./refinement-rules";

const o = (id: string, title: string, summary = "") => ({ id, title, summary, domain: "job" }) as never;

describe("규칙 기반 추가 질문", () => {
  const pool = [o("a", "A공단 정규직 채용"), o("b", "B재단 기간제 채용"), o("c", "C중견기업 인턴 모집", "중견기업 / 기간제"), o("d", "D 정규직 신입"), o("e", "E 인턴 채용")];
  it("남은 공고를 고르게 나누는 축으로 질문을 만들고 선택지마다 해당 공고가 있습니다", () => {
    const r = ruleRefinement(pool, [])!;
    expect(r.text).toBe("어떤 고용 형태를 원하십니까?");
    expect(r.options.map((x) => x.label)).toEqual(["정규직", "계약·기간제", "인턴·체험형"]);
    expect(r.options.every((x) => x.ids.length > 0)).toBe(true);
  });
  it("이미 한 질문은 다시 하지 않고 다음 축으로 넘어갑니다", () => {
    const r = ruleRefinement(pool, [{ question: { text: "어떤 고용 형태를 원하십니까? — 정규직" } }]);
    expect(r?.text).not.toBe("어떤 고용 형태를 원하십니까?");
  });
  it("나눌 수 없으면 null", () => {
    expect(ruleRefinement([o("x", "그냥 공고"), o("y", "다른 공고")], [])).toBeNull();
  });
});
