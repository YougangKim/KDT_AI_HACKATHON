import type { AttrValue, Condition, Domain, Question } from "../types";

const DOMAIN_LABEL: Record<Domain, string> = {
  housing: "청년 주택·임대",
  job: "채용·인턴",
  parttime: "알바",
  benefit: "지원금·혜택",
  training: "국비 교육과정",
  exam: "자격증 시험",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  student: "학생",
  jobseeker: "구직 중",
  employed: "직장인",
  parttime: "알바·단기 근로 중",
};

const list = (v: Condition["value"]): AttrValue[] => (Array.isArray(v) ? v : [v]);
const join = (v: Condition["value"], map?: Record<string, string>) =>
  list(v)
    .map((x) => (map ? (map[String(x)] ?? String(x)) : String(x)))
    .join("·");

/** 규칙 기반 기본 질문 문장(AI 없이). */
export function defaultQuestionText(q: Pick<Question, "attr" | "op" | "value">): string {
  const { attr, op, value } = q;
  const many = Array.isArray(value) && value.length > 1;
  switch (attr) {
    case "age":
      if (op === "lte") return `만 ${value}세 이하인가요?`;
      if (op === "gte") return `만 ${value}세 이상인가요?`;
      return `만 ${join(value)}세인가요?`;
    case "region":
      return many ? `${join(value)} 중 한 곳에 살고 있나요?` : `지금 ${join(value)}에 살고 있나요?`;
    case "homeless":
      return value === false ? "본인 명의 집이 있나요?" : "본인 명의 집이 없나요? (무주택)";
    case "livingAlone":
      return value === false ? "가족과 함께 살고 있나요?" : "혼자 살고 있나요? (1인 가구)";
    case "incomePct":
      if (op === "lte") return `가구 소득이 기준중위소득 ${value}% 이하인가요?`;
      if (op === "gte") return `가구 소득이 기준중위소득 ${value}% 이상인가요?`;
      return `가구 소득이 기준중위소득 ${join(value)}% 수준인가요?`;
    case "employment":
      return many
        ? `지금 ${join(value, EMPLOYMENT_LABEL)} 중 하나인가요?`
        : `지금 ${join(value, EMPLOYMENT_LABEL)}인가요?`;
    case "interest":
      return many
        ? `${join(value, DOMAIN_LABEL)} 중에 관심 있는 게 있나요?`
        : `${join(value, DOMAIN_LABEL)} 정보가 필요한가요?`;
  }
}

export function domainLabel(d: Domain): string {
  return DOMAIN_LABEL[d];
}
