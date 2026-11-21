// 임시 픽스처: T2 샘플·API가 없을 때 게임 개발·데모 폴백용. 실제 공고가 아니다.
import type { Condition, Domain, Opportunity } from "../../types";

const c = (
  attr: Condition["attr"],
  op: Condition["op"],
  value: Condition["value"],
  rawText: string,
  confidence: Condition["confidence"] = "high",
): Condition => ({ attr, op, value, rawText, confidence });

let n = 0;
const o = (
  domain: Domain,
  title: string,
  org: string,
  region: string[],
  conditions: Condition[],
  applyEnd?: string,
): Opportunity => ({
  id: `fixture:${++n}`,
  domain,
  title,
  org,
  region,
  summary: `${org} · ${title}`,
  conditions,
  applyEnd,
  url: "https://www.youthcenter.go.kr",
  source: "fixture",
  isSample: true,
  fetchedAt: "2026-11-21T00:00:00.000Z",
});

const AGE34 = c("age", "lte", 34, "만 19~34세 청년");
const AGE39 = c("age", "lte", 39, "만 39세 이하");
const HOMELESS = c("homeless", "eq", true, "무주택자");
const ALONE = c("livingAlone", "eq", true, "부모와 별도 거주하는 1인 가구");

export const FIXTURE_OPPORTUNITIES: Opportunity[] = [
  o("housing", "행복주택 청년 입주자 모집", "LH", [], [AGE39, HOMELESS, c("incomePct", "lte", 100, "가구 월평균소득 기준중위 100% 이하")], "2026-12-05"),
  o("housing", "청년 매입임대주택", "LH", ["서울", "경기"], [AGE39, HOMELESS, c("incomePct", "lte", 100, "본인·부모 합산 소득 중위 100% 이하", "low")], "2026-12-12"),
  o("housing", "서울 청년안심주택", "서울주택도시공사", ["서울"], [AGE39, HOMELESS], "2026-11-30"),
  o("benefit", "청년월세 특별지원", "국토교통부", [], [AGE34, HOMELESS, ALONE, c("incomePct", "lte", 60, "청년가구 소득 중위 60% 이하")], "2026-12-20"),
  o("benefit", "청년도약계좌", "서민금융진흥원", [], [AGE34, c("incomePct", "lte", 250, "가구소득 중위 250% 이하")], "2026-12-31"),
  o("benefit", "경기 청년 기본소득", "경기도", ["경기"], [c("age", "gte", 24, "만 24세"), c("age", "lte", 24, "만 24세")], "2026-12-10"),
  o("benefit", "국민취업지원제도 구직촉진수당", "고용노동부", [], [AGE34, c("employment", "eq", "jobseeker", "구직 중인 청년")]),
  o("job", "공공기관 청년 체험형 인턴", "잡알리오", [], [AGE34, c("employment", "in", ["student", "jobseeker"], "재학생·미취업 청년")], "2026-11-28"),
  o("job", "서울시 청년 일자리 사업", "서울시", ["서울"], [AGE39, c("employment", "eq", "jobseeker", "미취업 청년")], "2026-12-03"),
  o("parttime", "주말 카페 알바(샘플)", "샘플 매장", ["서울"], [c("age", "gte", 18, "만 18세 이상")]),
  o("parttime", "물류센터 단기 알바(샘플)", "샘플 물류", ["경기"], [c("age", "gte", 18, "만 18세 이상")]),
  o("training", "K-디지털 트레이닝 AI 과정", "고용노동부", [], [AGE34, c("employment", "in", ["student", "jobseeker"], "미취업자·졸업예정자")], "2026-12-15"),
  o("training", "국민내일배움카드 발급", "고용노동부", [], [c("employment", "in", ["jobseeker", "employed", "parttime"], "구직자·재직자(공무원·대학 재학 제외)")]),
  o("exam", "정보처리기사 2027 1회 필기", "한국산업인력공단", [], [], "2027-01-20"),
  o("exam", "컴퓨터활용능력 상시 시험", "대한상공회의소", [], []),
  o("benefit", "청년 마음건강 지원", "보건복지부", [], [AGE34]),
];
