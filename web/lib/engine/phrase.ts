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

export const EDU: Record<number, string> = { 1: "고졸", 2: "전문대졸", 3: "대졸(4년제)", 4: "석사", 5: "박사" };

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
      if (op === "lte") return `만 ${value}세 이하입니까?`;
      if (op === "gte") return `만 ${value}세 이상입니까?`;
      return `만 ${join(value)}세입니까?`;
    case "region":
      return many ? `${join(value)} 중 한 곳에 살고 있습니까?` : `지금 ${join(value)}에 살고 있습니까?`;
    case "homeless":
      return value === false ? "본인 명의 집이 있습니까?" : "본인 명의 집이 없습니까? (무주택)";
    case "livingAlone":
      return value === false ? "가족과 함께 살고 있습니까?" : "혼자 살고 있습니까? (1인 가구)";
    case "incomePct":
      if (op === "lte") return `가구 소득이 기준중위소득 ${value}% 이하입니까?`;
      if (op === "gte") return `가구 소득이 기준중위소득 ${value}% 이상입니까?`;
      return `가구 소득이 기준중위소득 ${join(value)}% 수준입니까?`;
    case "employment":
      return many
        ? `지금 ${join(value, EMPLOYMENT_LABEL)} 중 하나입니까?`
        : `지금 ${join(value, EMPLOYMENT_LABEL)}입니까?`;
    case "subscription":
      return "주택청약종합저축(청약통장)에 가입돼 있습니까?";
    case "married":
      return "결혼했거나 결혼 예정인 신혼부부입니까?";
    case "welfare":
      return "기초생활수급자나 차상위계층에 해당합니까?";
    case "experienced":
      return "지원하려는 분야의 경력이 있습니까?";
    case "education":
      return op === "gte" ? `최종 학력이 ${EDU[Number(value)] ?? value} 이상입니까?` : `최종 학력이 ${EDU[Number(value)] ?? value} 이하입니까?`;
    case "field":
      return `${join(value)} 분야 일자리를 찾습니까?`;
    case "topic":
      return `${join(value)} 항목을 선호합니까?`;
    case "need":
      return `${join(value)} 지원이 필요합니까?`;
    case "housingKind":
      return value === "sale" ? "내 집 마련(분양)을 찾습니까?" : "임대(월세·전세) 주택을 찾습니까?";
    case "interest":
      return many
        ? `${join(value, DOMAIN_LABEL)} 중에 관심 있는 게 있습니까?`
        : `${join(value, DOMAIN_LABEL)} 정보가 필요합니까?`;
  }
}

export function domainLabel(d: Domain): string {
  return DOMAIN_LABEL[d];
}
