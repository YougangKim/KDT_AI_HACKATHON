// 제목·자격요건에 드러난 대상 조건(청약통장·신혼부부·수급자)을 조건으로 붙인다.
// 질문을 더 풍부하게 만들고, 해당 없는 사람에게 "바로 신청"으로 잘못 보이지 않게 한다.
import type { Condition, Opportunity } from "../types";

const has = (o: Opportunity, attr: Condition["attr"]) => o.conditions.some((c) => c.attr === attr);
const c = (attr: Condition["attr"], rawText: string, confidence: Condition["confidence"] = "high"): Condition => ({ attr, op: "eq", value: true, rawText, confidence });

export function addTargetConditions(o: Opportunity, eligibility = ""): Opportunity {
  const extra: Condition[] = [];
  const t = o.title;
  // 청약홈 APT 일반 분양은 청약통장이 있어야 신청 가능(무순위·잔여세대는 통장 없이 가능)
  if (o.source === "applyhome" && !/무순위|잔여|취소/.test(t) && !has(o, "subscription")) extra.push(c("subscription", "청약통장(주택청약종합저축) 가입 필요"));
  // 신혼부부 전용(청년 함께 모집이면 붙이지 않음)
  if (/신혼희망타운|신혼부부/.test(t) && !/청년/.test(t) && !has(o, "married")) extra.push(c("married", "신혼부부 대상"));
  // 영구임대는 수급자·차상위 등이 주 대상
  if (/영구임대/.test(t) && !has(o, "welfare")) extra.push(c("welfare", "영구임대: 기초생활수급자·차상위 등 대상"));
  else if (/기초\s*생활\s*수급|차상위/.test(eligibility) && !has(o, "welfare"))
    extra.push(c("welfare", "자격요건에 수급자·차상위 언급(우대일 수 있음)", "low"));
  // 공공임대(행복·국민·영구·매입·전세임대 등)는 법령상 무주택세대구성원만 신청 가능
  if (o.domain === "housing" && /임대/.test(t) && !/민간임대|분양/.test(t) && o.source !== "applyhome" && !has(o, "homeless"))
    extra.push(c("homeless", "공공임대: 무주택세대구성원 대상"));
  // 주거 형태(취향): 청약홈·분양 공고는 분양, 나머지 주거는 임대
  if (o.domain === "housing" && !has(o, "housingKind")) {
    const sale = o.source === "applyhome" || /분양/.test(t);
    extra.push({ attr: "housingKind", op: "eq", value: sale ? "sale" : "rent", rawText: sale ? "분양(내 집 마련)" : "임대(월세·전세)", confidence: "high" });
  }
  return extra.length ? { ...o, conditions: [...o.conditions, ...extra] } : o;
}
