// 게임(T1) 없이 /result?demo=1 로 화면을 확인하기 위한 예시 결과
import type { AnswerRecord, Match } from "@/lib/types";

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

const now = new Date().toISOString();

export function sampleResult(): { answers: AnswerRecord[]; matches: Match[] } {
  const answers: AnswerRecord[] = [
    { question: { id: "homeless:eq:true", attr: "homeless", op: "eq", value: true, text: "지금 집이 없나요?" }, answer: "yes" },
    { question: { id: "region:eq:서울", attr: "region", op: "eq", value: "서울", text: "서울에 살아요?" }, answer: "yes" },
    { question: { id: "incomePct:lte:100", attr: "incomePct", op: "lte", value: 100, text: "소득이 중위 100% 이하예요?" }, answer: "unknown" },
  ];
  const matches: Match[] = [
    {
      opportunity: {
        id: "sample:housing-1",
        domain: "housing",
        title: "청년 매입임대주택 입주자 모집",
        org: "LH 서울지역본부",
        region: ["서울"],
        summary: "시세 40~50% 임대료로 최장 6년 거주",
        conditions: [],
        applyEnd: inDays(2),
        url: "https://apply.lh.or.kr",
        source: "sample",
        isSample: true,
        fetchedAt: now,
      },
      status: "needs_check",
      reasons: ["무주택이라고 답했어요", "서울 거주라고 답했어요"],
      unknowns: [
        {
          attr: "incomePct",
          op: "lte",
          value: 100,
          rawText: "본인과 부모의 월평균 소득이 전년도 도시근로자 가구원수별 월평균소득의 100% 이하인 자",
          confidence: "high",
        },
      ],
    },
    {
      opportunity: {
        id: "sample:benefit-1",
        domain: "benefit",
        title: "청년월세 한시 특별지원",
        org: "국토교통부",
        region: [],
        summary: "월 최대 20만 원, 최장 12개월 월세 지원",
        conditions: [],
        applyEnd: inDays(20),
        url: "https://www.bokjiro.go.kr",
        source: "sample",
        isSample: true,
        fetchedAt: now,
      },
      status: "eligible",
      reasons: ["무주택이라고 답했어요", "부모와 따로 산다고 답했어요"],
      unknowns: [],
    },
  ];
  return { answers, matches };
}
