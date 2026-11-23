/** 서비스가 생성하는 문구의 해요체 종결을 검사합니다. '필요', '요약' 같은 명사는 제외합니다. */
export function hasCasualEnding(text: string): boolean {
  return /(?:[가-힣]*(?:어요|아요|해요|돼요|예요|에요|나요|가요|까요|세요|네요|게요|려요|워요|줘요|군요))(?=$|[\s.!?…。？！"'’”])/u.test(text);
}

/** 이전에 저장한 답변은 유지하고 질문의 종결어미만 현재 표기로 표시합니다. */
export function formalQuestion(text: string): string {
  return text.replace(/인가요/g, "입니까").replace(/있나요/g, "있습니까")
    .replace(/없나요/g, "없습니까").replace(/되나요/g, "됩니까")
    .replace(/하나요/g, "합니까").replace(/찾나요/g, "찾습니까")
    .replace(/필요한가요/g, "필요합니까");
}
