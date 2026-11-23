import { describe, expect, it } from "vitest";
import { checkQuestionQuality, QUESTION_GUIDE, withQuestionGuide } from "./question-guide";

describe("질문 공용 지침", () => {
  it("좋은 질문은 통과", () => {
    expect(checkQuestionQuality("주거비 중 가장 부담되는 항목은 무엇입니까?", ["월세", "전세 보증금", "관리비"])).toBeNull();
  });
  it("상관없어요·중복·물음표 없음·소득 150%는 걸러낸다", () => {
    expect(checkQuestionQuality("어떤 일을 하고 싶습니까?", ["사무", "상관없어요"])).toBe("상관없어요 선택지");
    expect(checkQuestionQuality("어떤 일을 하고 싶습니까?", ["사무", "사 무"])).toBe("선택지 중복");
    expect(checkQuestionQuality("어떤 일을 하고 싶습니다", ["사무", "영업"])).toBe("물음표 없음");
    expect(checkQuestionQuality("가구 소득은 기준중위소득의 몇 %입니까?", ["100% 이하", "150% 이하"])).toBe("소득 범위 초과");
    expect(checkQuestionQuality("가구 소득은 기준중위소득의 몇 %입니까?", ["100% 이하", "100% 초과"])).toBeNull();
  });
  it("이미 한 질문은 다시 하지 않는다", () => {
    expect(checkQuestionQuality("어떤 집을 찾고 있습니까?", ["임대", "분양"], [{ text: "어떤 집을 찾고 있습니까? — 임대" }])).toBe("이미 한 질문");
  });
  it("모든 제공자 프롬프트 앞에 같은 지침이 붙는다", () => {
    expect(withQuestionGuide("작업")).toContain(QUESTION_GUIDE);
  });
});
