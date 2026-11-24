// 인터뷰 답(질문 기록) → 내 프로필 → 짧은 말(비교 표)·사실 문장(초안).
// 질문 원문(question.text)은 화면·초안 어디에도 쓰지 않는다.
import type { AnswerRecord, AttrKey } from "@/lib/types";
import { numericRange } from "@/lib/engine/answer-groups";

export interface Profile {
  age?: [number | null, number | null];
  incomePct?: [number | null, number | null];
  education?: number;
  region?: string;
  employment?: string;
  homeless?: boolean;
  livingAlone?: boolean;
  subscription?: boolean;
  married?: boolean;
  welfare?: boolean;
  experienced?: boolean;
  field?: string[];
  need?: string[];
}

const BOOL: AttrKey[] = ["homeless", "livingAlone", "subscription", "married", "welfare", "experienced"];

export function buildProfile(answers: AnswerRecord[]): Profile {
  const p: Profile = {};
  const by = (a: AttrKey) => answers.filter((r) => r.question.attr === a && r.answer !== "unknown");
  for (const a of ["age", "incomePct"] as const) {
    const g = by(a);
    if (!g.length) continue;
    const [lo, hi] = numericRange(g);
    if (lo !== null || hi !== null) p[a] = [lo, hi === Infinity ? null : hi];
  }
  const edu = numericRange(by("education"))[0];
  if (edu) p.education = edu;
  for (const a of BOOL) {
    const r = by(a)[0];
    if (r && typeof r.question.value === "boolean") (p as Record<string, unknown>)[a] = r.answer === "yes" ? r.question.value : !r.question.value;
  }
  const single = (a: AttrKey) => {
    const r = by(a).find((x) => x.answer === "yes");
    const v = r?.question.value;
    if (Array.isArray(v)) return v.length === 1 ? String(v[0]) : undefined;
    return v === undefined ? undefined : String(v);
  };
  p.region = single("region");
  p.employment = single("employment");
  const many = (a: AttrKey) => [...new Set(by(a).filter((x) => x.answer === "yes").flatMap((x) => (Array.isArray(x.question.value) ? x.question.value : [x.question.value]).map(String)))];
  const f = many("field"), n = many("need");
  if (f.length) p.field = f;
  if (n.length) p.need = n;
  return p;
}

const EMP_SHORT: Record<string, string> = { student: "학생", jobseeker: "구직 중", employed: "직장인", parttime: "알바·단기 근로 중" };
const EDU_SHORT: Record<number, string> = { 1: "고졸", 2: "전문대졸", 3: "대졸(4년제)", 4: "석사", 5: "박사" };

function range(r: [number | null, number | null] | undefined, unit: string, pre = "", post = "") {
  if (!r) return undefined;
  const [lo, hi] = r;
  if (lo !== null && hi !== null) return lo === hi ? `${pre}${lo}${unit}` : `${pre}${lo}~${hi}${unit}`;
  if (hi !== null) return `${pre}${hi}${unit} 이하${post}`;
  if (lo !== null) return `${pre}${lo}${unit} 이상${post}`;
  return undefined;
}

/** 비교 표 "내 답" 칸. 답이 없으면 undefined */
export function shortAnswer(p: Profile, attr: AttrKey): string | undefined {
  switch (attr) {
    case "age": return range(p.age, "세", "만 ");
    case "incomePct": return range(p.incomePct, "%", "기준중위소득 ");
    case "education": return p.education ? EDU_SHORT[p.education] ?? undefined : undefined;
    case "region": return p.region ? `${p.region} 거주` : undefined;
    case "employment": return p.employment ? EMP_SHORT[p.employment] ?? p.employment : undefined;
    case "homeless": return p.homeless === undefined ? undefined : p.homeless ? "무주택" : "주택 있음";
    case "livingAlone": return p.livingAlone === undefined ? undefined : p.livingAlone ? "1인 가구" : "가족과 거주";
    case "subscription": return p.subscription === undefined ? undefined : p.subscription ? "청약통장 있음" : "청약통장 없음";
    case "married": return p.married === undefined ? undefined : p.married ? "신혼(예비 포함)" : "해당 없음";
    case "welfare": return p.welfare === undefined ? undefined : p.welfare ? "수급·차상위" : "해당 없음";
    case "experienced": return p.experienced === undefined ? undefined : p.experienced ? "관련 경력 있음" : "관련 경력 없음";
    case "field": return p.field?.join("·");
    case "need": return p.need?.join("·");
    default: return undefined;
  }
}

/** 초안용 사실 문장. s = 끝맺는 꼴, j = 다음 문장과 잇는 꼴. 긍정 사실만 */
export interface Fact { attr: AttrKey; s: string; j: string }
const fact = (attr: AttrKey, s: string, j: string): Fact => ({ attr, s, j });

const EMP_FACT: Record<string, [string, string]> = {
  jobseeker: ["현재 일자리를 찾고 있습니다", "현재 일자리를 찾고 있으며"],
  student: ["학교에 다니고 있습니다", "학교에 다니고 있으며"],
  employed: ["현재 직장에 다니고 있습니다", "현재 직장에 다니고 있으며"],
  parttime: ["아르바이트를 하며 지내고 있습니다", "아르바이트를 하며 지내고 있고"],
};
const EDU_FACT: Record<number, [string, string]> = {
  1: ["고등학교를 졸업했습니다", "고등학교를 졸업했고"],
  2: ["전문대학을 졸업했습니다", "전문대학을 졸업했고"],
  3: ["4년제 대학을 졸업했습니다", "4년제 대학을 졸업했고"],
  4: ["석사 과정을 마쳤습니다", "석사 과정을 마쳤고"],
  5: ["박사 과정을 마쳤습니다", "박사 과정을 마쳤고"],
};

export function allFacts(p: Profile): Fact[] {
  const out: Fact[] = [];
  if (p.region) out.push(fact("region", `${p.region}에 살고 있습니다`, `${p.region}에 살고 있으며`));
  if (p.employment && EMP_FACT[p.employment]) out.push(fact("employment", ...EMP_FACT[p.employment]));
  if (p.education && EDU_FACT[p.education]) out.push(fact("education", ...EDU_FACT[p.education]));
  if (p.experienced === false) out.push(fact("experienced", "이 분야는 처음 도전합니다", "이 분야는 처음 도전하며"));
  if (p.experienced === true) out.push(fact("experienced", "관련 경력이 있습니다", "관련 경력이 있으며"));
  if (p.homeless) out.push(fact("homeless", "제 명의의 집이 없습니다", "제 명의의 집이 없고"));
  if (p.livingAlone) out.push(fact("livingAlone", "혼자 살고 있습니다", "혼자 살며"));
  const inc = p.incomePct?.[1];
  if (inc !== null && inc !== undefined) out.push(fact("incomePct", `가구 소득이 기준중위소득 ${inc}% 이하입니다`, `가구 소득이 기준중위소득 ${inc}% 이하이고`));
  if (p.subscription) out.push(fact("subscription", "청약통장에 가입해 있습니다", "청약통장에 가입해 있으며"));
  if (p.married) out.push(fact("married", "신혼부부(예비 포함)입니다", "신혼부부(예비 포함)이며"));
  if (p.welfare) out.push(fact("welfare", "기초생활수급·차상위 등 저소득 지원 대상입니다", "저소득 지원 대상이며"));
  const ageHi = p.age?.[1];
  if (ageHi !== null && ageHi !== undefined && ageHi <= 39) out.push(fact("age", `만 ${ageHi}세 이하 청년입니다`, `만 ${ageHi}세 이하 청년이며`));
  if (p.field?.length) out.push(fact("field", `${p.field[0]} 분야에서 일하고 싶습니다`, `${p.field[0]} 분야에서 일하고 싶으며`));
  if (p.need?.length) out.push(fact("need", `${p.need[0]} 지원이 필요합니다`, `${p.need[0]} 지원이 필요하며`));
  return out;
}

/** 공고 조건에 있는 속성 → 유형별 관련 속성 순으로 최대 n개 */
export function pickFacts(p: Profile, order: AttrKey[], condAttrs: AttrKey[], n = 2): Fact[] {
  const facts = allFacts(p);
  // 나이는 조건이어도 초안에서는 정보가 적어 맨 뒤
  const rank = (f: Fact) => (f.attr === "age" ? 1000 : 0) + (condAttrs.includes(f.attr) ? 0 : 100) + (order.includes(f.attr) ? order.indexOf(f.attr) : 50);
  return facts.filter((f) => order.includes(f.attr) || condAttrs.includes(f.attr)).sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

/** 사실 1~2개를 한 문장으로: "A며, B." */
export function joinFacts(fs: Fact[]): string {
  if (!fs.length) return "";
  if (fs.length === 1) return `${fs[0].s}.`;
  return `${fs[0].j}, ${fs[1].s}.`;
}
