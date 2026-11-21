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
    expect(regionStep).toMatchObject({
      aloneRemoved: 2,
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
          label: `${record.question.text} → 예`,
          attr: "incomePct",
          answer: record,
          aloneRemoved: 2,
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
});
