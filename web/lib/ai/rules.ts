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

  // 대상 단어는 "있다"고만 보지 않고, 바로 뒤가 제외·불가·무관이면(예: "재학생은 제외") 조건으로 만들지 않는다
  const MUJUTAEK = /무주택/;
  if (positive(text, MUJUTAEK)) out.push(cond("homeless", "eq", true, matchAround(text, MUJUTAEK), "high"));
  const ALONE = /1인\s*가구|부모와?\s*(따로|별도)|독립\s*거주|단독\s*세대/;
  if (positive(text, ALONE)) out.push(cond("livingAlone", "eq", true, matchAround(text, ALONE), "high"));

  // 고용 상태
  const emp: string[] = [];
  // "대학원 재학생은 제외"가 "대학원 재학"까지만 맞고 부정을 놓치지 않게 뒤의 "생"까지 포함
  if (positive(text, /(대학원|대학)\s*(재학|휴학)생?|재학생|대학생/)) emp.push("student");
  if (positive(text, /미취업|구직|실업|취업\s*준비/)) emp.push("jobseeker");
  if (positive(text, /재직|근로\s*중|근로소득|직장인/)) emp.push("employed");
  if (positive(text, /아르바이트|단시간|단기\s*근로/)) emp.push("parttime");
  if (emp.length) out.push(cond("employment", "in", emp, matchAround(text, /재학|대학생|미취업|구직|실업|재직|근로|직장인|아르바이트|단시간/), "low"));

  // 그동안 AI 해석에 맡기던 대상 조건(신혼·수급자·청약통장·경력·학력)도 원문 단어로 뽑는다.
  // 우대·가점일 수 있어 확신도는 low → 엔진에서 탈락 대신 "확인 필요"
  const MARRIED = /신혼\s*부부|예비\s*신혼|혼인\s*(신고\s*)?\d+\s*년\s*이내/;
  if (positive(text, MARRIED)) out.push(cond("married", "eq", true, matchAround(text, MARRIED), "low"));
  const WELFARE = /기초\s*생활\s*수급|생계\s*급여|주거\s*급여|차상위/;
  if (positive(text, WELFARE)) out.push(cond("welfare", "eq", true, matchAround(text, WELFARE), "low"));
  const SUBSCRIPTION = /청약\s*(통장|저축)|주택\s*청약\s*종합\s*저축/;
  if (positive(text, SUBSCRIPTION)) out.push(cond("subscription", "eq", true, matchAround(text, SUBSCRIPTION), "low"));
  const EXPERIENCED = /경력\s*\d+\s*년\s*이상|경력자(?!\s*우대)/;
  // "신입 및 경력 3년 이상"처럼 바로 앞에 신입이 함께 있으면(동시 모집) 경력 필수가 아니다. 문서 다른 곳의 "신입"은 보지 않는다
  if (!/경력\s*무관/.test(text) && [...text.matchAll(new RegExp(EXPERIENCED.source, "g"))].some((m) => !NEGATED_AFTER.test(text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12)) && !/신입\s*(및|과|·|\/|,|또는|와)?\s*$/.test(text.slice(Math.max(0, (m.index ?? 0) - 8), m.index))))
    out.push(cond("experienced", "eq", true, matchAround(text, EXPERIENCED), "low"));
  if (!/학력\s*(무관|제한\s*없)/.test(text)) {
    const edu = /박사\s*(학위)?\s*(소지|이상)/.test(text) ? 5 : /석사\s*(학위)?\s*(소지|이상)/.test(text) ? 4 : /(4년제\s*)?대학교?\s*졸업|학사\s*(학위)?\s*(소지|이상)/.test(text) ? 3 : /전문\s*대(학)?\s*졸업/.test(text) ? 2 : /고등학교\s*졸업|고졸/.test(text) ? 1 : 0;
    if (edu) out.push(cond("education", "gte", edu, matchAround(text, /석사|박사|대학교?\s*졸업|학사|전문\s*대|고등학교\s*졸업|고졸/), "low"));
  }

  const regions = regionsIn(text);
  if (regions.length) out.push(cond("region", "in", regions, matchAround(text, /서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주/), "low"));

  return out;
}

/** 바로 뒤에 붙으면 "그 대상이 아니다"가 되는 말(예: "재학생은 제외", "무주택 요건 없음") */
// 조사(은·는·이·가·도·을·를)와 "여부·요건"을 건너뛰고 본다: "재학생을 제외", "무주택 여부 무관", "신혼부부가 아닌 자"
const NEGATED_AFTER = /^\s*[은는이가도을를]?\s*(여부\s*)?(요건\s*)?[은는이가을를]?\s*(제외|불가|무관|해당\s*없|해당하지\s*않|없음|아닌|아니|미해당|대상\s*아님)/;

/** 원문에 그 표현이 "대상"으로 나오는지: 나온 곳 중 하나라도 뒤가 부정·예외가 아니면 true */
function positive(text: string, re: RegExp): boolean {
  const g = new RegExp(re.source, "g");
  for (const m of text.matchAll(g)) {
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    if (!NEGATED_AFTER.test(after)) return true;
  }
  return false;
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
