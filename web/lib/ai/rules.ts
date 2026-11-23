// 규칙 기반 폴백: 키가 없거나 AI 호출이 실패하면 이 함수들을 쓴다.
import type { AttrKey, Condition, Match, Question } from "../types";

export const REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"] as const;

const REGION_ALIASES: [RegExp, string][] = [
  [/서울/, "서울"], [/부산/, "부산"], [/대구/, "대구"], [/인천/, "인천"], [/광주광역|광주시|^광주/, "광주"],
  [/대전/, "대전"], [/울산/, "울산"], [/세종/, "세종"], [/경기/, "경기"], [/강원/, "강원"],
  [/충청북|충북/, "충북"], [/충청남|충남/, "충남"], [/전라북|전북/, "전북"], [/전라남|전남/, "전남"],
  [/경상북|경북/, "경북"], [/경상남|경남/, "경남"], [/제주/, "제주"],
];

/** "서울특별시 강남구", "경기도" 같은 표기를 시도 약칭으로 바꾼다. 못 찾으면 null */
export function normalizeRegion(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (/전국/.test(t)) return null;
  for (const [re, name] of REGION_ALIASES) if (re.test(t)) return name;
  return null;
}

/** 문장 안에 언급된 시도 목록(중복 제거) */
export function regionsIn(text: string): string[] {
  const found = new Set<string>();
  for (const part of text.split(/[,·/\s()]+/)) {
    const r = normalizeRegion(part);
    if (r) found.add(r);
  }
  return [...found];
}

function cond(attr: AttrKey, op: Condition["op"], value: Condition["value"], rawText: string, confidence: Condition["confidence"]): Condition {
  return { attr, op, value, rawText, confidence };
}

/** 자격요건 원문 → Condition[] (정규식 규칙). 확실하지 않은 것은 confidence "low" */
export function structureConditionsRules(rawText: string): Condition[] {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out: Condition[] = [];

  // 나이: "만 19세 ~ 34세", "19~39세", "만 19세 이상 39세 이하", "만 34세 이하", "만 18세 이상"
  const range = text.match(/(?:만\s*)?(\d{2})\s*세?\s*(?:이상)?\s*(?:~|-|–|부터)\s*(?:만\s*)?(\d{2})\s*세/) ?? text.match(/(?:만\s*)?(\d{2})\s*세\s*이상\s*(?:만\s*)?(\d{2})\s*세\s*(?:이하|미만)/);
  if (range) {
    const min = Number(range[1]);
    let max = Number(range[2]);
    // "18~40세 미만"처럼 미만이 범위 뒤에 붙는 경우도 39세까지로 본다
    const after = text.slice((range.index ?? 0) + range[0].length, (range.index ?? 0) + range[0].length + 4);
    if (/미만/.test(range[0]) || /^\s*미만/.test(after)) max -= 1;
    if (min < max) {
      out.push(cond("age", "gte", min, range[0], "high"));
      out.push(cond("age", "lte", max, range[0], "high"));
    }
  } else {
    const max = text.match(/(?:만\s*)?(\d{2})\s*세\s*(이하|미만)/);
    if (max) out.push(cond("age", "lte", Number(max[1]) - (max[2] === "미만" ? 1 : 0), max[0], "high"));
    const min = text.match(/(?:만\s*)?(\d{2})\s*세\s*이상/);
    if (min) out.push(cond("age", "gte", Number(min[1]), min[0], "high"));
  }

  // 소득: "기준중위소득 150% 이하", "월평균소득 100% 이하"
  const income = text.match(/(기준\s*중위\s*소득|중위소득|월평균\s*소득)[^0-9%]{0,10}(\d{2,3})\s*%\s*(이하|미만|이내)?/);
  if (income) out.push(cond("incomePct", "lte", Number(income[2]), income[0], /중위/.test(income[1]) ? "high" : "low"));

  if (/무주택/.test(text)) out.push(cond("homeless", "eq", true, matchAround(text, /무주택/), "high"));
  if (/1인\s*가구|부모와?\s*(따로|별도)|독립\s*거주|단독\s*세대/.test(text))
    out.push(cond("livingAlone", "eq", true, matchAround(text, /1인\s*가구|부모와?\s*(따로|별도)|독립\s*거주|단독\s*세대/), "high"));

  // 고용 상태
  const emp: string[] = [];
  if (/(대학|대학원)\s*(재학|휴학)|재학생|대학생/.test(text)) emp.push("student");
  if (/미취업|구직|실업|취업\s*준비/.test(text)) emp.push("jobseeker");
  if (/재직|근로\s*중|근로소득|직장인/.test(text)) emp.push("employed");
  if (/아르바이트|단시간|단기\s*근로/.test(text)) emp.push("parttime");
  if (emp.length) out.push(cond("employment", "in", emp, matchAround(text, /재학|대학생|미취업|구직|실업|재직|근로|직장인|아르바이트|단시간/), "low"));

  const regions = regionsIn(text);
  if (regions.length) out.push(cond("region", "in", regions, matchAround(text, /서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주/), "low"));

  return out;
}

function matchAround(text: string, re: RegExp): string {
  const m = text.match(re);
  if (!m || m.index == null) return text.slice(0, 60);
  return text.slice(Math.max(0, m.index - 15), m.index + m[0].length + 25).trim();
}

const EMP_LABEL: Record<string, string> = { student: "대학생(재학·휴학)", jobseeker: "취업 준비 중", employed: "직장에 다니는 중", parttime: "알바 중" };
const DOMAIN_LABEL: Record<string, string> = { housing: "집(청년 주택)", job: "채용·인턴", parttime: "알바", benefit: "지원금·혜택", training: "국비 교육과정", exam: "자격증 시험" };

/** 질문 → 게임 말투 문장(템플릿) */
export function phraseQuestionRules(q: Pick<Question, "attr" | "op" | "value">): string {
  const v = q.value;
  const list = Array.isArray(v) ? v : [v];
  switch (q.attr) {
    case "age":
      if (q.op === "lte") return `만 ${v}세 이하입니까?`;
      if (q.op === "gte") return `만 ${v}세 이상입니까?`;
      return `지금 만 ${v}세입니까?`;
    case "region":
      return `${list.join("·")}에 살고 있습니까?`;
    case "homeless":
      return v ? "지금 본인 명의 집이 없는 무주택자입니까?" : "본인 명의 집이 있습니까?";
    case "livingAlone":
      return v ? "부모님과 따로 혼자 살고 있습니까?" : "부모님과 함께 살고 있습니까?";
    case "incomePct":
      return `가구 소득이 기준중위소득 ${v}% 이하입니까? (불확실하면 '모름' 선택)`;
    case "employment":
      return `지금 ${list.map((e) => EMP_LABEL[String(e)] ?? String(e)).join(" 또는 ")}입니까?`;
    case "subscription":
      return "청약통장(주택청약종합저축) 있어?";
    case "married":
      return "결혼했거나 곧 결혼하는 신혼부부입니까?";
    case "welfare":
      return "기초생활수급자나 차상위계층입니까?";
    case "experienced":
      return "그 분야 경력이 있습니까?";
    case "education":
      return `최종 학력이 ${v}단계 이상입니까?`;
    case "field":
    case "topic":
      return `${list.join("·")} 쪽 일자리를 찾습니까?`;
    case "need":
      return `${list.join("·")} 지원이 필요합니까?`;
    case "housingKind":
      return v === "sale" ? "분양으로 내 집 마련할 계획입니까?" : "임대(월세·전세) 주택을 찾습니까?";
    case "interest":
      return `${list.map((d) => DOMAIN_LABEL[String(d)] ?? String(d)).join("·")} 쪽 기회를 찾고 있어?`;
  }
}

/** 매칭 결과 → 한두 문장 설명(템플릿) */
export function explainMatchRules(m: Match): string {
  const o = m.opportunity;
  const why = m.reasons.length ? `${m.reasons.slice(0, 3).join(", ")} 조건이 일치하므로` : "답변과 어긋나는 조건이 없으므로";
  const end = o.applyEnd ? ` 마감은 ${o.applyEnd}입니다.` : " 상시 모집입니다.";
  const check = m.unknowns.length ? ` 다만 '${m.unknowns.map((u) => u.rawText).slice(0, 2).join("', '")}'은 원문 확인이 필요하다.` : "";
  return `${o.org}의 「${o.title}」은 ${why} 선정했습니다.${end}${check}`;
}
