import { describe, expect, it } from "vitest";
import { planText, ruleBasedPlan } from "./index";
import { checkDraft } from "./draft";
import { cleanTitle, prepKind, shortTitle } from "./kind";
import type { AnswerRecord } from "@/lib/types";

const q = (attr: string, op: string, value: unknown, text: string, answer: "yes" | "no" | "unknown"): AnswerRecord =>
  ({ question: { id: `${attr}:${op}:${value}`, attr, op, value, text }, answer }) as never;

// 사용자 스크린샷 상황: 서울 예, 채용 정보 예, 알바 정보 예, 나이 25~29
const ANSWERS: AnswerRecord[] = [
  q("region", "eq", "서울", "지금 서울에 살고 있습니까?", "yes"),
  q("interest", "eq", "job", "채용·인턴 정보가 필요합니까?", "yes"),
  q("interest", "eq", "parttime", "알바 정보가 필요합니까?", "yes"),
  q("age", "lte", 29, "만 29세 이하입니까?", "yes"),
  q("age", "lte", 24, "만 24세 이하입니까?", "no"),
  q("employment", "eq", "jobseeker", "지금 일자리를 찾고 있습니까?", "yes"),
];

const match = (o: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  opportunity: { id: "x", region: [], conditions: [], url: "https://example.org", isSample: false, fetchedAt: "", source: "t", ...o },
  status: "eligible", reasons: [], unknowns: [], ...extra,
}) as never;

const EVENT = match({
  domain: "job", source: "work24-event", org: "고용24 채용행사",
  title: "77_(일자리 수요데이) 중장년 취업이음+ (주)면사랑 구인구직 만남의 날 면접 공동행사",
  summary: "서울 마포구 / 행사 2026-11-27", applyEnd: "2026-11-23",
  apply: { how: "고용24 채용행사 안내에서 참가 방법 확인", url: "https://www.work24.go.kr/" },
  conditions: [{ attr: "interest", op: "eq", value: "job", rawText: "분야: 채용·인턴", confidence: "high" }],
});

const ALL_TEXT = (p: ReturnType<typeof ruleBasedPlan>) => JSON.stringify(p);

describe("신청 준비 — 중장년 채용 행사(사용자 제보 사례)", () => {
  const p = ruleBasedPlan(EVENT, ANSWERS, new Date("2026-11-23T10:00:00"));
  it("행사형으로 판별하고 제목을 정리합니다", () => {
    expect(p.kind).toBe("job_event");
    expect(p.title.startsWith("중장년 취업이음+")).toBe(true);
    expect(p.series).toBe("일자리 수요데이 77회");
  });
  it("중장년 대상 경고를 띄우고 나이 행을 비교 표에 넣습니다", () => {
    expect(p.target.level).toBe("warn");
    expect(p.target.why).toMatch(/중장년'이 있어/);
    expect(p.target.why).toMatch(/만 25~29세/);
    expect(p.rows[0]).toMatchObject({ cond: "나이 — 원문에 숫자 없음", mine: "만 25~29세", verdict: "check" });
  });
  it("취향 조건은 비교 표가 아니라 찾던 것에 둡니다", () => {
    expect(p.rows.some((r) => /분야/.test(r.cond))).toBe(false);
    expect(p.prefs).toEqual(["채용·인턴"]);
  });
  it("한눈에: 회사·장소·행사일을 공고에서 뽑습니다", () => {
    expect(p.glance.what).toBe("(주)면사랑 현장 면접");
    expect(p.glance.where).toBe("서울 마포구");
    expect(p.glance.when).toBe("행사 2026-11-27");
  });
  it("범용 서류 대신 행사 준비물, 오늘 마감 순서를 냅니다", () => {
    const names = p.docs.map((d) => d.name);
    expect(names).toContain("이력서 출력본 3~5부");
    expect(names).not.toContain("최종학력 졸업(예정)증명서");
    expect(p.steps[1].when).toBe("오늘 마감 전");
    expect(p.steps.at(-1)?.when).toBe("행사 2026-11-27");
  });
  it("초안은 30초 자기소개·현장 질문이고 질문 원문이 어디에도 없습니다", () => {
    expect(p.drafts.map((d) => d.title)).toEqual(["30초 자기소개", "현장에서 물어볼 질문"]);
    expect(ALL_TEXT(p)).not.toMatch(/살고 있습니까|필요합니까|→ 예|제 상황\(/);
    expect(p.drafts[0].body).toMatch(/현재 일자리를 찾고 있습니다/);
    expect(p.drafts[0].body).toMatch(/\(주\)면사랑/);
    expect(p.drafts[0].body).not.toMatch(/고용24 채용행사의/);
  });
});

describe("신청 준비 — 유형별", () => {
  it("나이 조건이 내 답보다 높으면 대상 아님(block)", () => {
    const p = ruleBasedPlan(match({ domain: "benefit", title: "신중년 재취업 수당", org: "○○시", summary: "", conditions: [{ attr: "age", op: "gte", value: 50, rawText: "만 50세 이상", confidence: "high" }] }), ANSWERS);
    expect(p.target.level).toBe("block");
  });
  it("지원금: 공고 서류·소득 서류·금액 구절과 사실 문장으로 신청 사유를 씁니다", () => {
    const ans = [...ANSWERS, q("livingAlone", "eq", true, "혼자 살고 있습니까?", "yes"), q("incomePct", "lte", 60, "소득 60% 이하입니까?", "yes")];
    const p = ruleBasedPlan(match({ domain: "benefit", title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원. 임대차계약서 사본을 제출합니다.", applyEnd: "2026-12-10",
      conditions: [{ attr: "incomePct", op: "lte", value: 150, rawText: "기준중위소득 150% 이하", confidence: "high" }] }), ans, new Date("2026-11-23"));
    expect(p.kind).toBe("benefit_cash");
    expect(p.docs[0]).toMatchObject({ name: "임대차계약서 사본", src: "posting" });
    expect(p.docs.some((d) => d.name === "건강보험료 납부확인서")).toBe(true);
    expect(p.rows[0]).toMatchObject({ mine: "기준중위소득 60% 이하", verdict: "ok" });
    expect(p.drafts[0].body).toMatch(/가구 소득이 기준중위소득 60% 이하/);
    expect(p.drafts[0].body).toMatch(/'월 최대 20만 원'/);
    expect(p.steps[1].when).toBe("12/5까지");
  });
  it("채용: 기관명이 출처 이름이 아니면 주어로 쓰고, 지원 동기·강점을 냅니다", () => {
    const p = ruleBasedPlan(match({ domain: "job", title: "2026 체험형 청년인턴", org: "○○공단", summary: "통계 자료 정리" }), ANSWERS);
    expect(p.kind).toBe("job");
    expect(p.drafts[0].body.startsWith("○○공단의 「2026 체험형 청년인턴」에 지원합니다.")).toBe(true);
    expect(p.drafts[1].title).toBe("강점 3줄");
  });
  it("주거 분양·자격증은 자기소개서가 필요 없다고 안내합니다", () => {
    expect(ruleBasedPlan(match({ domain: "exam", title: "정보처리기사", org: "한국산업인력공단", summary: "" }), []).drafts).toEqual([]);
    expect(ruleBasedPlan(match({ domain: "housing", title: "공공분양 청약", org: "LH", summary: "" }), []).draftNote).toMatch(/자기소개서/);
  });
  it("유형 판별과 제목 정리", () => {
    expect(prepKind({ domain: "job", title: "청년 일자리 박람회", org: "○○구", source: "x" })).toBe("job_event");
    expect(cleanTitle("12_(수요데이) 테스트 행사")).toEqual({ title: "테스트 행사", series: "수요데이", num: "12" });
    expect(shortTitle("77_(일자리 수요데이) 중장년 취업이음+ (주)면사랑 구인구직 만남의 날 면접 공동행사", "job_event")).toBe("(주)면사랑 면접 공동행사");
  });
});

describe("초안 품질 검사", () => {
  const o = { title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원" };
  it("현재 앱이 내던 초안(질문 원문 삽입)은 실패합니다", () => {
    const bad = { title: "지원 동기", body: "고용24 채용행사의 「서울시 청년월세 지원」 공고를 보고 지원합니다. 제 상황(지금 서울에 살고 있습니까?, 채용·인턴 정보가 필요합니까?)과 잘 맞는다고 판단했습니다. 입사 후에는 맡은 업무를 빠르게 익혀 기여하겠습니다." };
    expect(checkDraft(bad, o).length).toBeGreaterThan(0);
  });
  it("공고에 없는 숫자·상투 문장·개인정보는 실패합니다", () => {
    expect(checkDraft({ title: "신청 사유", body: "「서울시 청년월세 지원」의 월 30만 원을 받아 생활비에 보태고자 신청합니다. 성실하게 살겠습니다." }, o)).toContain("공고에 없는 숫자");
    expect(checkDraft({ title: "신청 사유", body: "「서울시 청년월세 지원」에 신청합니다. 연락처는 010-1234-5678입니다. 잘 부탁드립니다." }, o).length).toBeGreaterThan(0);
  });
  it("좋은 예는 통과합니다", () => {
    const good = { title: "신청 사유", body: "혼자 살며 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 45만 원 중 일부]에 보태고자 신청합니다." };
    expect(checkDraft(good, o, { facts: "가구 소득이 기준중위소득 60% 이하입니다" })).toEqual([]);
  });
});

describe("AI 초안 되돌리기 기준", () => {
  it("[이름]을 지우거나 원문 필드를 그대로 인용한 초안은 실패합니다(실측 출력)", () => {
    const o = { title: "중장년 취업이음+ (주)면사랑 구인구직 만남의 날 면접 공동행사", org: "고용24 채용행사", summary: "서울 마포구 / 행사 2026-11-27" };
    const rule = "안녕하세요, [이름]입니다. 현재 일자리를 찾고 있습니다. [관련 경험: 예) 고객 응대 아르바이트 1년]을 해 왔습니다. 오늘 (주)면사랑의 채용 계획을 듣고, [희망 직무: 예) 생산·품질 관리]로 일할 수 있는지 여쭙고 싶어 참여했습니다.";
    const ai = { title: "30초 자기소개", body: "현재 일자리를 찾고 있습니다. 「중장년 취업이음+ (주)면사랑 구인구직 만남의 날 면접 공동행사」의 '서울 마포구 / 행사 2026-11-27'에 참여하여 [관련 경험: 예) 고객 응대 아르바이트 1년]을 바탕으로 [희망 직무: 예) 생산·품질 관리]에 지원하고자 합니다." };
    const why = checkDraft(ai, o, { rule, ruleBlanks: 2 });
    expect(why).toContain("[이름] 삭제");
    expect(why).toContain("원문 필드를 그대로 인용");
  });
});

describe("교차 평가 지적 반영", () => {
  const NOW = new Date("2026-11-23T10:00:00");
  const base = { domain: "benefit", title: "청년 지원금", org: "○○시", summary: "", applyEnd: "2026-12-31" };
  it("확인할 조건이 남으면 초록(ok)이 아니라 check", () => {
    const p = ruleBasedPlan(match(base, { status: "needs_check", unknowns: [{ attr: "incomePct", op: "lte", value: 60, rawText: "기준중위소득 60% 이하", confidence: "high" }] }), ANSWERS, NOW);
    expect(p.target.level).toBe("check");
  });
  it("다른 지역 한정 공고는 block", () => {
    expect(ruleBasedPlan(match({ ...base, region: ["부산"] }), ANSWERS, NOW).target.level).toBe("block");
  });
  it("요약에만 '중장년 대상'이 있어도 warn", () => {
    const p = ruleBasedPlan(match({ ...base, domain: "job", title: "취업이음 면접행사", summary: "중장년 구직자 대상 현장 면접" }), ANSWERS, NOW);
    expect(p.target.level).toBe("warn");
    expect(p.target.why).toMatch(/공고 요약에 '중장년'이/);
  });
  it("마감이 지나면 block·순서 1줄", () => {
    const p = ruleBasedPlan(match({ ...base, applyEnd: "2026-11-20" }), ANSWERS, NOW);
    expect(p.target).toMatchObject({ level: "block", expired: true });
    expect(p.steps).toHaveLength(1);
  });
  it("대상 확인 전(warn) 전체 복사에는 초안이 없습니다", () => {
    const p = ruleBasedPlan(EVENT, ANSWERS, NOW);
    expect(planText(p, (EVENT as { opportunity: never }).opportunity)).not.toMatch(/30초 자기소개/);
    expect(planText(p, (EVENT as { opportunity: never }).opportunity, true)).toMatch(/30초 자기소개/);
  });
  it("AI가 규칙 초안에 없는 문장(이유)을 덧붙이면 실패", () => {
    const o = { title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원" };
    const rule = "혼자 살며, 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다.";
    const ai = { title: "신청 사유", body: "혼자 살며 가구 소득이 기준중위소득 60% 이하입니다. 월세 부담이 매우 큽니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다." };
    expect(checkDraft(ai, o, { rule, facts: "60%" })).toContain("문장 추가");
  });
});

describe("재검증 지적 반영", () => {
  const NOW = new Date("2026-11-23T10:00:00");
  it("'서울특별시' 공고와 '서울' 답은 같은 지역", () => {
    expect(ruleBasedPlan(match({ domain: "benefit", title: "청년 지원금", org: "○○", summary: "", region: ["서울특별시"] }), ANSWERS, NOW).target.level).toBe("ok");
  });
  it("같은 문장 수로 없는 사유를 지어내면 실패", () => {
    const o = { title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원" };
    const rule = "혼자 살며, 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다.";
    const ai = { title: "신청 사유", body: "부모님의 지원이 끊겨 생활이 어렵습니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다." };
    expect(checkDraft(ai, o, { rule, facts: "가구 소득이 기준중위소득 60% 이하입니다" }).some((w) => w.startsWith("새 내용 추가"))).toBe(true);
    const ok = { title: "신청 사유", body: "혼자 살며 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 합니다." };
    expect(checkDraft(ok, o, { rule, facts: "가구 소득이 기준중위소득 60% 이하입니다" })).toEqual([]);
  });
});

describe("최종 재검증 지적 반영", () => {
  const NOW = new Date("2026-11-23T10:00:00");
  const o = { title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원" };
  const rule = "혼자 살며, 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다.";
  const facts = "혼자 살고 있습니다 가구 소득이 기준중위소득 60% 이하입니다";
  it("'전국' 공고는 지역 차단하지 않습니다", () => {
    const p = ruleBasedPlan(match({ domain: "benefit", title: "청년 지원금", org: "○○", summary: "", region: ["전국"] }), ANSWERS, NOW);
    expect(p.target.level).toBe("ok");
    expect(p.rows.some((r) => r.cond.startsWith("지역"))).toBe(false);
  });
  it("짧은 허위 사유 한 문장으로 바꿔치기해도 실패", () => {
    const ai = { title: "신청 사유", body: "부모 지원이 끊겼습니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 신청합니다." };
    expect(checkDraft(ai, o, { rule, facts }).some((w) => w.startsWith("새 내용 추가"))).toBe(true);
  });
  it("빈칸 예시를 바꾸면 실패", () => {
    const ai = { title: "신청 사유", body: "혼자 살며 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 생활비 전부]에 보태고자 신청합니다." };
    expect(checkDraft(ai, o, { rule, facts })).toContain("빈칸 내용 변경");
  });
  it("연결어만 다듬은 초안은 통과", () => {
    const ai = { title: "신청 사유", body: "혼자 살며 가구 소득이 기준중위소득 60% 이하입니다. 「서울시 청년월세 지원」의 '월 최대 20만 원'을 받아 [쓸 곳: 예) 월세 일부]에 보태고자 합니다." };
    expect(checkDraft(ai, o, { rule, facts })).toEqual([]);
  });
});
