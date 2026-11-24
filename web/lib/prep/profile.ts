// 인터뷰 답(질문 기록) → 내 프로필 → 비교 표의 짧은 말.
// 질문 원문(question.text)은 화면에 쓰지 않는다.
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
