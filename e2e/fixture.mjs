// 시나리오 테스트용 고정 공고(실제 API 대신 /api/opportunities 응답으로 주입). 실데이터 형식과 같다.
const base = { applyStart: "2026-11-01", applyEnd: "2026-12-20", isSample: false, origin: "api", fetchedAt: "2026-11-22T00:00:00Z" };
const c = {
  housing: { attr: "interest", op: "eq", value: "housing", rawText: "분야: 주거", confidence: "high" },
  benefit: { attr: "interest", op: "eq", value: "benefit", rawText: "분야: 지원금", confidence: "high" },
  region: (r) => ({ attr: "region", op: "in", value: [r], rawText: `대상 지역: ${r}`, confidence: "high" }),
  homeless: { attr: "homeless", op: "eq", value: true, rawText: "무주택자", confidence: "high" },
  age34: { attr: "age", op: "lte", value: 34, rawText: "만 34세 이하", confidence: "high" },
  inc: (n) => ({ attr: "incomePct", op: "lte", value: n, rawText: `기준중위소득 ${n}% 이하`, confidence: "high" }),
  alone: { attr: "livingAlone", op: "eq", value: true, rawText: "1인 가구", confidence: "high" },
};
const opp = (id, domain, title, region, conds, extra = {}) => ({
  ...base,
  id: `fx:${id}`,
  domain,
  title,
  org: "테스트 기관",
  region: region ? [region] : [],
  summary: `${title} 요약`,
  conditions: [domain === "housing" ? c.housing : c.benefit, ...(region ? [c.region(region)] : []), ...conds],
  url: `https://example.org/${id}`,
  source: domain === "housing" ? "lh-notice" : "gov24",
  ...extra,
});

export const FIXTURE = [
  // 주거: 서울 6건 + 다른 지역 5건
  opp("h1", "housing", "서울 행복주택 청년 입주자 모집", "서울", [c.homeless]),
  opp("h2", "housing", "서울 매입임대주택 청년 예비입주자", "서울", [c.homeless]),
  opp("h3", "housing", "서울 청년안심주택 공급", "서울", [c.homeless]),
  opp("h4", "housing", "서울 역세권 청년주택", "서울", [c.homeless, c.age34]),
  opp("h5", "housing", "서울 청년 전세임대", "서울", [c.homeless, c.inc(100)]),
  opp("h6", "housing", "서울 공공임대 잔여세대", "서울", []),
  opp("h7", "housing", "부산 행복주택 청년", "부산", [c.homeless]),
  opp("h8", "housing", "경기 행복주택 청년", "경기", [c.homeless]),
  opp("h9", "housing", "인천 매입임대 청년", "인천", [c.homeless]),
  opp("h10", "housing", "대구 행복주택 청년", "대구", [c.homeless]),
  opp("h11", "housing", "광주 청년 전세임대", "광주", [c.homeless]),
  // 지원금: 부산은 소득 기준이 있는 공고가 많다(적은 결과 시나리오)
  opp("b1", "benefit", "서울 청년월세 지원", "서울", [c.inc(60), c.homeless]),
  opp("b2", "benefit", "부산 청년 월세 지원", "부산", [c.inc(60), c.alone]),
  opp("b3", "benefit", "청년도약계좌", null, [c.age34]),
  opp("b4", "benefit", "부산 청년 교통비 지원", "부산", [c.age34]),
  opp("b5", "benefit", "서울 청년수당", "서울", []),
  opp("b6", "benefit", "경기 청년기본소득", "경기", [c.age34]),
  opp("b7", "benefit", "부산 청년 구직활동수당", "부산", [c.inc(60)]),
  opp("b8", "benefit", "부산 1인가구 청년 생활지원", "부산", [c.inc(60), c.alone]),
  opp("b9", "benefit", "부산 청년 전세대출 이자 지원", "부산", [c.inc(60), c.homeless]),
  opp("b10", "benefit", "서울 청년 교통비", "서울", []),
  opp("b11", "benefit", "경기 청년 교통비", "경기", []),
  opp("b12", "benefit", "인천 청년 교통비", "인천", []),
];

// 알림 저장 뒤 새로 올라오는 공고(반복 조사 검증용): 서울 무주택 조건에 맞는 것 1건, 다른 지역 1건
export const NEW_MATCHING = opp("n1", "housing", "서울 신규 청년 매입임대 추가 모집", "서울", [c.homeless]);
export const NEW_OTHER_REGION = opp("n2", "housing", "부산 신규 행복주택 추가 모집", "부산", [c.homeless]);
