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

// 이 속성들은 화면에서 한 번에 고르지만 내부적으로 여러 AnswerRecord를 만든다.
const GROUPED_ATTRS = new Set<Condition["attr"]>([
  "region",
  "incomePct",
  "age",
  "employment",
  "education",
  "interest",
  "field",
  "need",
  "housingKind",
]);

const QUESTION_TEXT: Record<Condition["attr"], string> = {
  topic: "어떤 주제의 공고를 우선 탐색합니까?",
  age: "만 나이가 어떻게 됩니까?",
  region: "지금 어디에 살고 있습니까?",
  homeless: "본인 명의 집이 있습니까?",
  livingAlone: "현재 1인 가구입니까?",
  incomePct: "가구 소득은 기준중위소득의 몇 % 정도입니까?",
  employment: "지금 어떤 상태입니까?",
  interest: "어떤 정보가 필요합니까?",
  subscription: "청약통장이 있습니까?",
  married: "신혼부부 또는 예비 신혼부부입니까?",
  welfare: "수급자 또는 차상위 대상입니까?",
  experienced: "관련 경력이 있습니까?",
  education: "최종 학력이 어떻게 됩니까?",
  field: "어떤 분야의 일을 찾고 있습니까?",
  need: "어떤 지원이 필요합니까?",
  housingKind: "어떤 집을 찾고 있습니까?",
};

const REASON_TEXT: Record<Condition["attr"], string> = {
  topic: "선택한 탐색 주제와 다른 공고",
  age: "나이 기준이 맞지 않는 공고",
  region: "다른 지역 대상 공고",
  homeless: "주택 보유 기준이 맞지 않는 공고",
  livingAlone: "가구 형태 기준이 맞지 않는 공고",
  incomePct: "소득 기준이 맞지 않는 공고",
  employment: "취업 상태 기준이 맞지 않는 공고",
  interest: "고르지 않은 분야",
  subscription: "청약통장 조건이 맞지 않는 공고",
  married: "혼인 조건이 맞지 않는 공고",
  welfare: "복지 대상 조건이 맞지 않는 공고",
  experienced: "경력 조건이 맞지 않는 공고",
  education: "학력 기준이 맞지 않는 공고",
  field: "고르지 않은 분야",
  need: "고르지 않은 지원 종류",
  housingKind: "원하는 주거 형태와 다른 공고",
};

const EDUCATION: Record<number, string> = {
  1: "고졸 이하",
  2: "전문대졸",
  3: "대졸(4년제)",
  4: "석사",
  5: "박사",
};

function groupKey(record: AnswerRecord): string {
  return GROUPED_ATTRS.has(record.question.attr)
    ? record.question.attr
    : record.question.id;
}

function groupedAnswers(answers: AnswerRecord[]): AnswerRecord[][] {
  const groups = new Map<string, AnswerRecord[]>();
  for (const record of answers) {
    const key = groupKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.values()];
}

function numericRange(records: AnswerRecord[], unit: string): string {
  const lower = records
    .filter((r) => r.answer === "no" && r.question.op === "lte")
    .map((r) => Number(r.question.value) + 1);
  const upper = records
    .filter((r) => r.answer === "yes" && r.question.op === "lte")
    .map((r) => Number(r.question.value));
  const min = lower.length ? Math.max(...lower) : null;
  const max = upper.length ? Math.min(...upper) : null;
  if (min !== null && max !== null) return `${min}~${max}${unit}`;
  if (max !== null) return `${max}${unit} 이하`;
  if (min !== null) return `${min}${unit} 이상`;
  return "모름";
}

function answerText(records: AnswerRecord[]): string {
  const attr = records[0].question.attr;
  const selected = records
    .filter((r) => r.answer === "yes")
    .flatMap((r) => values(r.question.value));

  if (attr === "age") return numericRange(records, "세");
  if (attr === "incomePct") return numericRange(records, "%");
  if (attr === "education") {
    const level = selected.map(Number).sort((a, b) => b - a)[0];
    return EDUCATION[level] ?? "모름";
  }
  if (attr === "employment") {
    return selected.map((v) => EMPLOYMENT_LABEL[v] ?? v).join("·") || "모름";
  }
  if (attr === "interest") {
    return selected.map((v) => DOMAIN_LABEL[v as Domain] ?? v).join("·") || "선택하지 않음";
  }
  if (attr === "housingKind") {
    return selected.map((v) => v === "rent" ? "임대(월세·전세)" : "분양(내 집 마련)").join("·") || "둘 다";
  }
  if (GROUPED_ATTRS.has(attr)) return selected.join("·") || "선택하지 않음";

  const record = records[0];
  const effective = record.answer === "yes";
  if (typeof record.question.value === "boolean") {
    return effective === record.question.value ? "예" : "아니오";
  }
  return effective ? values(record.question.value).join("·") : "아니오";
}

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

  const groups = groupedAnswers(answers);
  const activeGroups = groups.filter((group) => group.some(({ answer }) => answer !== "unknown"));
  const pendingGroups = groups.filter((group) => group.every(({ answer }) => answer === "unknown"));
  let remaining = pool;
  const steps: FilterStep[] = activeGroups.map((group) => {
      const before = remaining;
      const nextMatches = getMatches({ pool: before, answers: group });
      const nextIds = new Set(nextMatches.map((match) => match.opportunity.id));
      const removed = before.filter((opportunity) => !nextIds.has(opportunity.id));
      remaining = nextMatches.map((match) => match.opportunity);
      const answer = group.find((record) => record.answer !== "unknown") ?? group[0];
      const passedWithout = getMatches({
        pool,
        answers: replaceAnswer(answers, answer.question.id, "unknown"),
      }).length;
      // 한 번에 고르는 질문(지역·소득 등)만 공통 문구, 예/아니오 질문은 실제로 물은 문장을 그대로(답의 뜻이 뒤집히지 않게)
      const question = (GROUPED_ATTRS.has(answer.question.attr) ? QUESTION_TEXT[answer.question.attr] : "")
        || answer.question.text
        || defaultQuestionText(answer.question);
      const answerLabel = answerText(group);

      return {
        questionId: answer.question.id,
        relatedAnswerIds: group.map((record) => record.question.id),
        question,
        answerLabel,
        reason: REASON_TEXT[answer.question.attr],
        label: `${question} → ${answerLabel}`,
        attr: answer.question.attr,
        answer,
        removedCount: removed.length,
        aloneRemoved: removed.length,
        removedIds: removed.map((opportunity) => opportunity.id),
        examples: removed.slice(0, 3).map((opportunity) => opportunity.title),
        passedWithout,
        hard: group.some((record) => hardIdSet.has(record.question.id)),
      };
    });

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
  const relaxed = gains[0];
  // 사는 곳은 쉽게 바꿀 수 없으니, 다른 조건을 먼저 제안하고 지역은 마지막에
  const relaxOptions = [
    ...gains.filter(({ step }) => step.attr !== "region"),
    ...gains.filter(({ step }) => step.attr === "region"),
  ]
    .slice(0, 3)
    .map((r) => ({ ...r, suggestion: relaxationText(r.step, r.gain) }));

  const pendingAttrs = new Set(pendingGroups.map((group) => group[0].question.attr));
  const pendingCount = matches.filter(
    (match) => match.unknowns.some((condition) => pendingAttrs.has(condition.attr)),
  ).length;
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
    pendingCount,
    pendingQuestions: pendingGroups.map((group) => ({
      attr: group[0].question.attr,
      question: (GROUPED_ATTRS.has(group[0].question.attr) ? QUESTION_TEXT[group[0].question.attr] : "")
        || group[0].question.text
        || defaultQuestionText(group[0].question),
    })),
    scarce: passed <= 3 || passRate < 0.05,
  };
}

export function relaxationText(step: FilterStep, gain: number): string {
  switch (step.attr) {
    case "topic": return `탐색 주제를 넓히면 ${gain}건이 더 표시됩니다`;
    case "incomePct":
      return `소득 기준을 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "region":
      return `다른 지역 공고도 함께 보면 ${gain}건이 더 표시됩니다`;
    case "age":
      return `나이 기준을 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "homeless":
      return `주택 보유 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "livingAlone":
      return `1인 가구 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "employment":
      return `취업 상태를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "interest":
      return `다른 분야 공고도 함께 보면 ${gain}건이 더 표시됩니다`;
    case "subscription":
      return `청약통장 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "married":
      return `신혼부부 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "welfare":
      return `수급자·차상위 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "experienced":
      return `경력 여부를 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "education":
      return `학력을 "모름"으로 두면 ${gain}건이 더 표시됩니다`;
    case "field":
      return `다른 직무 분야도 함께 보면 ${gain}건이 더 표시됩니다`;
    case "need":
      return `다른 종류의 지원도 함께 보면 ${gain}건이 더 표시됩니다`;
    case "housingKind":
      return `임대·분양을 모두 보면 ${gain}건이 더 표시됩니다`;
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
