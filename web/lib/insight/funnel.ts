import type {
  Answer,
  AnswerRecord,
  Condition,
  Domain,
  Opportunity,
  Question,
} from "../types";
import { defaultQuestionText, getMatches } from "../engine";
import type { FilterStep, FunnelReport } from "./types";

const DOMAINS: Domain[] = [
  "housing",
  "job",
  "parttime",
  "benefit",
  "training",
  "exam",
];

const DOMAIN_LABEL: Record<Domain, string> = {
  housing: "주거",
  job: "채용",
  parttime: "알바",
  benefit: "지원금",
  training: "국비과정",
  exam: "자격증",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  student: "학생",
  jobseeker: "구직 중",
  employed: "재직 중",
  parttime: "알바 중",
};

const values = (value: Condition["value"]) =>
  (Array.isArray(value) ? value : [value]).map(String);

// 소득·나이는 선택지 하나로 여러 기준(50·60·80·100%)에 한꺼번에 답하므로 완화도 한꺼번에 한다
const GROUPED_ATTRS = new Set(["incomePct", "age"]);

/** 완화할 때 함께 "모름"으로 바꿀 답들의 id(소득·나이는 같은 속성 전부) */
export function relatedAnswerIds(answers: AnswerRecord[], questionId: string): Set<string> {
  const target = answers.find((a) => a.question.id === questionId);
  if (!target || !GROUPED_ATTRS.has(target.question.attr)) return new Set([questionId]);
  return new Set(answers.filter((a) => a.question.attr === target.question.attr).map((a) => a.question.id));
}

const replaceAnswer = (
  answers: AnswerRecord[],
  questionId: string,
  answer: Answer,
): AnswerRecord[] => {
  const ids = relatedAnswerIds(answers, questionId);
  return answers.map((record) => (ids.has(record.question.id) ? { ...record, answer } : record));
};

export function analyzeFunnel(
  pool: Opportunity[],
  answers: AnswerRecord[],
  hardIds: string[] = [],
): FunnelReport {
  const activeAnswers = answers.filter(({ answer }) => answer !== "unknown");
  const matches = getMatches({ pool, answers });
  const passed = matches.length;
  const hardIdSet = new Set(hardIds);

  const byDomain = Object.fromEntries(
    DOMAINS.map((domain) => [
      domain,
      {
        total: pool.filter((opportunity) => opportunity.domain === domain).length,
        passed: matches.filter(
          ({ opportunity }) => opportunity.domain === domain,
        ).length,
      },
    ]),
  ) as FunnelReport["byDomain"];

  const steps: FilterStep[] = activeAnswers
    .map((answer) => {
      const aloneIds = new Set(getMatches({ pool, answers: [answer] }).map((m) => m.opportunity.id));
      const alonePassed = aloneIds.size;

      const passedWithout = getMatches({
        pool,
        answers: replaceAnswer(answers, answer.question.id, "unknown"),
      }).length;

      return {
        questionId: answer.question.id,
        label: `${answer.question.text || defaultQuestionText(answer.question)} → ${
          answer.answer === "yes" ? "예" : "아니오"
        }`,
        attr: answer.question.attr,
        answer,
        aloneRemoved: pool.length - alonePassed,
        removedIds: pool.filter((o) => !aloneIds.has(o.id)).map((o) => o.id),
        passedWithout,
        hard: hardIdSet.has(answer.question.id),
      };
    })
    .sort(
      (a, b) =>
        b.aloneRemoved - a.aloneRemoved ||
        a.questionId.localeCompare(b.questionId),
    );

  const gains = steps
    .filter(({ hard }) => !hard)
    .map((step) => ({
      step,
      gain: step.passedWithout - passed,
    }))
    .filter(({ gain }) => gain > 0)
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        b.step.aloneRemoved - a.step.aloneRemoved ||
        a.step.questionId.localeCompare(b.step.questionId),
    );
  // 같은 속성(소득·나이)의 여러 답은 완화 결과가 같으므로 하나만 남긴다
  const seenAttr = new Set<string>();
  const uniqueGains = gains.filter(({ step }) => {
    if (!GROUPED_ATTRS.has(step.attr)) return true;
    if (seenAttr.has(step.attr)) return false;
    seenAttr.add(step.attr);
    return true;
  });
  const relaxed = uniqueGains[0];
  // 사는 곳은 쉽게 바꿀 수 없으니, 다른 조건을 먼저 제안하고 지역은 마지막에
  const relaxOptions = [
    ...uniqueGains.filter(({ step }) => step.attr !== "region"),
    ...uniqueGains.filter(({ step }) => step.attr === "region"),
  ]
    .slice(0, 3)
    .map((r) => ({ ...r, suggestion: relaxationText(r.step, r.gain) }));

  const passRate = pool.length === 0 ? 0 : passed / pool.length;

  return {
    total: pool.length,
    passed,
    passRate,
    byDomain,
    steps,
    bottleneck: relaxed
      ? {
          ...relaxed,
          suggestion: relaxationText(relaxed.step, relaxed.gain),
        }
      : null,
    relaxOptions,
    scarce: passed <= 3 || passRate < 0.05,
  };
}

export function relaxationText(step: FilterStep, gain: number): string {
  switch (step.attr) {
    case "incomePct":
      return `소득 기준을 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "region":
      return `다른 지역 공고도 함께 보면 ${gain}건이 더 보여요`;
    case "age":
      return `나이 기준을 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "homeless":
      return `주택 보유 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "livingAlone":
      return `1인 가구 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "employment":
      return `취업 상태를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "interest":
      return `다른 분야 공고도 함께 보면 ${gain}건이 더 보여요`;
    case "subscription":
      return `청약통장 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "married":
      return `신혼부부 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "welfare":
      return `수급자·차상위 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "experienced":
      return `경력 여부를 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "education":
      return `학력을 "모름"으로 두면 ${gain}건이 더 보여요`;
    case "field":
      return `다른 직무 분야도 함께 보면 ${gain}건이 더 보여요`;
    case "need":
      return `다른 종류의 지원도 함께 보면 ${gain}건이 더 보여요`;
    case "housingKind":
      return `임대·분양을 모두 보면 ${gain}건이 더 보여요`;
  }
}

function effectiveBoolean(
  question: Question,
  answer: Exclude<Answer, "unknown">,
): boolean | null {
  if (question.op !== "eq" || typeof question.value !== "boolean") return null;
  return answer === "yes" ? question.value : !question.value;
}

function numericSummary(
  question: Question,
  answer: Exclude<Answer, "unknown">,
  unit: string,
): string {
  const value = Number(question.value);

  if (question.op === "lte") {
    return answer === "yes"
      ? `${unit} ${value}${unit === "만" ? "세" : "%"} 이하`
      : `${unit} ${value + 1}${unit === "만" ? "세" : "%"} 이상`;
  }

  if (question.op === "gte") {
    return answer === "yes"
      ? `${unit} ${value}${unit === "만" ? "세" : "%"} 이상`
      : `${unit} ${value - 1}${unit === "만" ? "세" : "%"} 이하`;
  }

  return answer === "yes"
    ? `${unit} ${value}${unit === "만" ? "세" : "%"}`
    : `${unit} ${value}${unit === "만" ? "세" : "%"}가 아닌`;
}

export function summarizeConditions(answers: AnswerRecord[]): string {
  const active = answers.filter(
    (record): record is AnswerRecord & {
      answer: Exclude<Answer, "unknown">;
    } => record.answer !== "unknown",
  );

  if (active.length === 0) return "조건을 아직 정하지 않은 청년";

  const descriptors: string[] = [];
  const clauses: string[] = [];
  const interests: string[] = [];
  const excludedInterests: string[] = [];

  for (const { question, answer } of active) {
    const labels = values(question.value);

    switch (question.attr) {
      case "region":
        descriptors.push(
          answer === "yes"
            ? `${labels.join("·")}에 사는`
            : `${labels.join("·")}에 살지 않는`,
        );
        break;

      case "age":
        descriptors.push(numericSummary(question, answer, "만"));
        break;

      case "homeless": {
        const value = effectiveBoolean(question, answer);
        if (value !== null) descriptors.push(value ? "무주택" : "유주택");
        break;
      }

      case "subscription":
      case "married":
      case "welfare":
      case "experienced": {
        const value = effectiveBoolean(question, answer);
        const label = {
          subscription: "청약통장 가입",
          married: "신혼·예비 신혼",
          welfare: "수급자·차상위",
          experienced: "관련 경력 있음",
        }[question.attr];
        if (value !== null) descriptors.push(value ? label : `${label} 아님`);
        break;
      }

      case "livingAlone": {
        const value = effectiveBoolean(question, answer);
        if (value !== null) {
          descriptors.push(value ? "1인 가구" : "가족과 함께 사는");
        }
        break;
      }

      case "incomePct":
        descriptors.push(`${numericSummary(question, answer, "기준중위소득")}인`);
        break;

      case "employment": {
        const employment = labels
          .map((value) => EMPLOYMENT_LABEL[value] ?? value)
          .join("·");

        descriptors.push(answer === "yes" ? `${employment}인` : `${employment}이 아닌`);
        break;
      }

      case "interest": {
        const target = answer === "yes" ? interests : excludedInterests;
        target.push(
          ...labels.map(
            (value) => DOMAIN_LABEL[value as Domain] ?? value,
          ),
        );
        break;
      }

      case "education":
        descriptors.push(`${labels.join("·")} 학력`);
        break;

      case "field":
        clauses.push(`직무: ${labels.join("·")}`);
        break;

      case "need":
        clauses.push(`필요 지원: ${labels.join("·")}`);
        break;

      case "housingKind":
        clauses.push(
          `주거 형태: ${labels.map((value) => value === "rent" ? "임대" : value === "sale" ? "분양" : value).join("·")}`,
        );
        break;
    }
  }

  if (interests.length > 0) clauses.push(`관심: ${[...new Set(interests)].join("·")}`);
  if (excludedInterests.length > 0) clauses.push(`제외: ${[...new Set(excludedInterests)].join("·")}`);

  const subject = [...descriptors, "청년"].join(" ");
  return clauses.length > 0 ? `${subject} · ${clauses.join(" · ")}` : subject;
}
