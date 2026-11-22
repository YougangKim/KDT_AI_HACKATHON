import { describe, expect, it } from "vitest";
import type {
  Answer,
  AnswerRecord,
  Condition,
  Domain,
  Opportunity,
  Question,
} from "../types";
import { getMatches } from "../engine";
import { FIXTURE_OPPORTUNITIES } from "../engine/__fixtures__/opportunities";
import {
  analyzeFunnel,
  relaxationText,
  summarizeConditions,
} from "./funnel";

const condition = (
  attr: Condition["attr"],
  op: Condition["op"],
  value: Condition["value"],
): Condition => ({
  attr,
  op,
  value,
  rawText: `${attr} ${op} ${String(value)}`,
  confidence: "high",
});

const opportunity = (
  id: string,
  domain: Domain,
  conditions: Condition[],
  region: string[] = [],
): Opportunity => ({
  id,
  domain,
  title: id,
  org: "테스트 기관",
  region,
  summary: "",
  conditions,
  url: "https://example.com",
  source: "test",
  isSample: true,
  fetchedAt: "2026-11-21",
});

const question = (
  attr: Condition["attr"],
  op: Condition["op"],
  value: Condition["value"],
  text: string,
): Question => ({
  id: `${attr}:${op}:${String(value)}`,
  attr,
  op,
  value,
  text,
});

const answer = (
  question: Question,
  value: Answer,
): AnswerRecord => ({
  question,
  answer: value,
});

describe("analyzeFunnel", () => {
  it("passed와 분야별 passed가 getMatches 판정과 일치한다", () => {
    const answers: AnswerRecord[] = [
      answer(
        question("age", "lte", 34, "만 34세 이하인가요?"),
        "yes",
      ),
      answer(
        question("employment", "eq", "jobseeker", "지금 구직 중인가요?"),
        "yes",
      ),
    ];

    const report = analyzeFunnel(FIXTURE_OPPORTUNITIES, answers);
    const matches = getMatches({
      pool: FIXTURE_OPPORTUNITIES,
      answers,
    });

    expect(report.passed).toBe(matches.length);

    for (const domain of [
      "housing",
      "job",
      "parttime",
      "benefit",
      "training",
      "exam",
    ] as const) {
      expect(report.byDomain[domain].passed).toBe(
        matches.filter(
          ({ opportunity }) => opportunity.domain === domain,
        ).length,
      );
    }
  });

  it("aloneRemoved와 passedWithout를 각각 엔진으로 계산한다", () => {
    const homeless = question(
      "homeless",
      "eq",
      true,
      "본인 명의 집이 없나요? (무주택)",
    );
    const region = question(
      "region",
      "eq",
      "부산",
      "지금 부산에 살고 있나요?",
    );

    const pool = [
      opportunity(
        "homeless",
        "housing",
        [condition("homeless", "eq", true)],
      ),
      opportunity("seoul", "job", [], ["서울"]),
      opportunity(
        "both",
        "benefit",
        [condition("homeless", "eq", true)],
        ["서울"],
      ),
      opportunity("all", "exam", []),
    ];

    const answers = [
      answer(homeless, "no"),
      answer(region, "yes"),
    ];
    const report = analyzeFunnel(pool, answers);

    expect(report.passed).toBe(1);
    expect(report.steps.map(({ questionId }) => questionId)).toEqual([
      homeless.id,
      region.id,
    ]);

    const homelessStep = report.steps.find(
      ({ questionId }) => questionId === homeless.id,
    );
    const regionStep = report.steps.find(
      ({ questionId }) => questionId === region.id,
    );

    expect(homelessStep).toMatchObject({
      aloneRemoved: 2,
      passedWithout: 2,
    });
    // 제외 수는 앞 단계(무주택 답) 이후 남은 공고 기준으로 센다: 서울 공고 1건만 새로 빠진다
    expect(regionStep).toMatchObject({
      aloneRemoved: 1,
      passedWithout: 2,
    });
    expect(homelessStep?.label).toBe(
      "본인 명의 집이 없나요? (무주택) → 아니오",
    );
  });

  it("hard 조건은 bottleneck 후보에서 제외한다", () => {
    const homeless = question(
      "homeless",
      "eq",
      true,
      "본인 명의 집이 없나요? (무주택)",
    );
    const region = question(
      "region",
      "eq",
      "부산",
      "지금 부산에 살고 있나요?",
    );

    const pool = [
      opportunity(
        "homeless",
        "housing",
        [condition("homeless", "eq", true)],
      ),
      opportunity("seoul", "job", [], ["서울"]),
      opportunity(
        "both",
        "benefit",
        [condition("homeless", "eq", true)],
        ["서울"],
      ),
      opportunity("all", "exam", []),
    ];

    const report = analyzeFunnel(
      pool,
      [answer(homeless, "no"), answer(region, "yes")],
      [homeless.id],
    );

    expect(report.bottleneck?.step.questionId).toBe(region.id);
    expect(report.bottleneck?.gain).toBe(1);
    expect(report.bottleneck?.suggestion).toBe(
      "다른 지역 공고도 함께 보면 1건이 더 보여요",
    );
  });

  it("완화 제안은 여러 개를 주되 바꾸기 어려운 지역은 마지막에 둔다", () => {
    const homeless = question("homeless", "eq", true, "본인 명의 집이 없나요? (무주택)");
    const region = question("region", "eq", "부산", "지금 부산에 살고 있나요?");
    const pool = [
      opportunity("seoul1", "job", [], ["서울"]),
      opportunity("seoul2", "job", [], ["서울"]),
      opportunity("seoul3", "job", [], ["서울"]),
      opportunity("home", "housing", [condition("homeless", "eq", true)]),
      opportunity("ok", "exam", []),
    ];
    const report = analyzeFunnel(pool, [answer(homeless, "no"), answer(region, "yes")]);

    expect(report.bottleneck?.step.attr).toBe("region"); // 가장 많이 막은 조건은 지역(+3)
    expect(report.relaxOptions.map((r) => r.step.attr)).toEqual(["homeless", "region"]);
    expect(report.relaxOptions[0].suggestion).toBe('주택 보유 여부를 "모름"으로 두면 1건이 더 보여요');
  });

  it("답변이 없으면 모든 후보가 통과하고 bottleneck은 null이다", () => {
    const report = analyzeFunnel(FIXTURE_OPPORTUNITIES, []);

    expect(report.passed).toBe(FIXTURE_OPPORTUNITIES.length);
    expect(report.passRate).toBe(1);
    expect(report.steps).toEqual([]);
    expect(report.bottleneck).toBeNull();
  });

  it("unknown 답변은 단계 계산에서 제외한다", () => {
    const unknown = answer(
      question(
        "incomePct",
        "lte",
        100,
        "가구 소득이 기준중위소득 100% 이하인가요?",
      ),
      "unknown",
    );

    const report = analyzeFunnel(FIXTURE_OPPORTUNITIES, [unknown]);

    expect(report.steps).toEqual([]);
    expect(report.passed).toBe(
      getMatches({
        pool: FIXTURE_OPPORTUNITIES,
        answers: [unknown],
      }).length,
    );
  });

  it("다중선택 답을 질문 하나로 묶고 고르지 않은 값들을 별도 단계로 만들지 않는다", () => {
    const answers = [
      answer(question("field", "eq", "보건·의료", "보건·의료 분야인가요?"), "yes"),
      answer(question("field", "eq", "교육", "교육 분야인가요?"), "yes"),
      answer(question("field", "eq", "건설", "건설 분야인가요?"), "no"),
    ];
    const pool = [
      opportunity("medical", "job", [condition("field", "eq", "보건·의료")]),
      opportunity("education", "job", [condition("field", "eq", "교육")]),
      opportunity("construction", "job", [condition("field", "eq", "건설")]),
    ];

    const report = analyzeFunnel(pool, answers);

    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]).toMatchObject({
      question: "어떤 분야의 일을 찾고 있나요?",
      answerLabel: "보건·의료·교육",
      reason: "고르지 않은 분야",
    });
    expect(report.steps[0].relatedAnswerIds).toHaveLength(3);
  });

  it("소득의 여러 내부 기준을 사람이 고른 구간 한 줄로 묶는다", () => {
    const answers = [
      answer(question("incomePct", "lte", 80, "소득 80% 이하인가요?"), "no"),
      answer(question("incomePct", "lte", 100, "소득 100% 이하인가요?"), "yes"),
      answer(question("incomePct", "lte", 120, "소득 120% 이하인가요?"), "yes"),
    ];

    const report = analyzeFunnel(FIXTURE_OPPORTUNITIES, answers);

    expect(report.steps).toHaveLength(1);
    expect(report.steps[0].answerLabel).toBe("81~100%");
  });

  it("질문 순서를 유지하고 제외 수를 앞 단계 대비 감소로 계산한다", () => {
    const region = answer(
      question("region", "eq", "서울", "지금 서울에 살고 있나요?"),
      "yes",
    );
    const homeless = answer(
      question("homeless", "eq", true, "무주택인가요?"),
      "yes",
    );
    const pool = [
      opportunity("seoul-home", "housing", [condition("homeless", "eq", true)], ["서울"]),
      opportunity("seoul-owned", "housing", [], ["서울"]),
      opportunity("busan-home", "housing", [condition("homeless", "eq", true)], ["부산"]),
      opportunity("busan-owned", "housing", [], ["부산"]),
    ];

    const report = analyzeFunnel(pool, [region, homeless]);

    expect(report.steps.map((step) => step.attr)).toEqual(["region", "homeless"]);
    // 무주택 "예"는 무주택 조건이 없는 공고를 빼지 않는다
    expect(report.steps.map((step) => step.removedCount)).toEqual([2, 0]);
  });

  it("모르겠어요 질문과 그 때문에 확인이 필요한 공고 수를 집계한다", () => {
    const income = answer(
      question("incomePct", "lte", 100, "소득을 아나요?"),
      "unknown",
    );
    const pool = [
      opportunity("income", "benefit", [condition("incomePct", "lte", 100)]),
      opportunity("plain", "benefit", []),
    ];

    const report = analyzeFunnel(pool, [income]);

    expect(report.steps).toEqual([]);
    expect(report.pendingQuestions).toEqual([
      {
        attr: "incomePct",
        question: "가구 소득은 기준중위소득의 몇 % 정도인가요?",
      },
    ]);
    expect(report.pendingCount).toBe(1);
  });

  it("후보 100건과 답변 10개를 즉시 분석한다", () => {
    const pool = Array.from({ length: 100 }, (_, index) => ({
      ...FIXTURE_OPPORTUNITIES[
        index % FIXTURE_OPPORTUNITIES.length
      ],
      id: `performance:${index}`,
    }));

    const answers = Array.from({ length: 10 }, (_, index) =>
      answer(
        question(
          "age",
          "lte",
          25 + index,
          `만 ${25 + index}세 이하인가요?`,
        ),
        index % 3 === 0 ? "unknown" : "yes",
      ),
    );

    const startedAt = performance.now();
    const report = analyzeFunnel(pool, answers);
    const elapsed = performance.now() - startedAt;

    expect(report.total).toBe(100);
    expect(elapsed).toBeLessThan(1_000);
  });
});

describe("relaxationText", () => {
  it("속성에 맞는 한국어 제안을 반환한다", () => {
    const record = answer(
      question(
        "incomePct",
        "lte",
        100,
        "가구 소득이 기준중위소득 100% 이하인가요?",
      ),
      "yes",
    );

    expect(
      relaxationText(
        {
          questionId: record.question.id,
          relatedAnswerIds: [record.question.id],
          question: record.question.text,
          answerLabel: "100% 이하",
          reason: "소득 기준이 맞지 않는 공고",
          label: `${record.question.text} → 예`,
          attr: "incomePct",
          answer: record,
          removedCount: 2,
          aloneRemoved: 2,
          removedIds: [],
          examples: [],
          passedWithout: 5,
          hard: false,
        },
        3,
      ),
    ).toBe('소득 기준을 "모름"으로 두면 3건이 더 보여요');
  });
});

describe("summarizeConditions", () => {
  it("지역·나이·가구·고용·관심 분야를 한 문장으로 요약한다", () => {
    const answers = [
      answer(
        question("region", "eq", "서울", "지금 서울에 살고 있나요?"),
        "yes",
      ),
      answer(
        question("age", "lte", 34, "만 34세 이하인가요?"),
        "yes",
      ),
      answer(
        question(
          "homeless",
          "eq",
          true,
          "본인 명의 집이 없나요? (무주택)",
        ),
        "yes",
      ),
      answer(
        question(
          "livingAlone",
          "eq",
          true,
          "혼자 살고 있나요? (1인 가구)",
        ),
        "yes",
      ),
      answer(
        question(
          "employment",
          "eq",
          "jobseeker",
          "지금 구직 중인가요?",
        ),
        "yes",
      ),
      answer(
        question(
          "interest",
          "eq",
          "housing",
          "주거 정보가 필요한가요?",
        ),
        "yes",
      ),
      answer(
        question(
          "interest",
          "eq",
          "job",
          "채용 정보가 필요한가요?",
        ),
        "yes",
      ),
    ];

    expect(summarizeConditions(answers)).toBe(
      "서울에 사는 만 34세 이하 무주택 1인 가구 구직 중인 청년 · 관심: 주거·채용",
    );
  });

  it("아니오 답변을 자연스러운 부정형으로 요약한다", () => {
    const answers = [
      answer(
        question("region", "eq", "서울", "지금 서울에 살고 있나요?"),
        "no",
      ),
      answer(
        question(
          "homeless",
          "eq",
          true,
          "본인 명의 집이 없나요? (무주택)",
        ),
        "no",
      ),
      answer(
        question(
          "employment",
          "eq",
          "jobseeker",
          "지금 구직 중인가요?",
        ),
        "no",
      ),
      answer(
        question(
          "interest",
          "eq",
          "housing",
          "주거 정보가 필요한가요?",
        ),
        "no",
      ),
    ];

    expect(summarizeConditions(answers)).toBe(
      "서울에 살지 않는 유주택 구직 중이 아닌 청년 · 제외: 주거",
    );
  });

  it("모름 답변을 생략하고 답변이 없으면 기본 문장을 반환한다", () => {
    const unknown = answer(
      question(
        "incomePct",
        "lte",
        100,
        "가구 소득이 기준중위소득 100% 이하인가요?",
      ),
      "unknown",
    );

    expect(summarizeConditions([unknown])).toBe(
      "조건을 아직 정하지 않은 청년",
    );
    expect(summarizeConditions([])).toBe(
      "조건을 아직 정하지 않은 청년",
    );
  });

  it("청약·신혼·복지·경력·학력·직무·지원·주거 형태를 요약한다", () => {
    const answers = [
      answer(question("subscription", "eq", true, "청약통장이 있나요?"), "yes"),
      answer(question("married", "eq", true, "신혼부부인가요?"), "no"),
      answer(question("welfare", "eq", true, "수급자인가요?"), "yes"),
      answer(question("experienced", "eq", true, "경력이 있나요?"), "no"),
      answer(question("education", "eq", 3, "최종 학력은?"), "yes"),
      answer(question("field", "in", ["사무", "IT"], "관심 직무는?"), "yes"),
      answer(question("need", "in", ["주거·자립"], "필요한 지원은?"), "yes"),
      answer(question("housingKind", "eq", "rent", "어떤 집을 찾나요?"), "yes"),
    ];
    expect(summarizeConditions(answers)).toContain("청약통장 가입");
    expect(summarizeConditions(answers)).toContain("직무: 사무·IT");
    expect(summarizeConditions(answers)).toContain("주거 형태: 임대");
  });
});
