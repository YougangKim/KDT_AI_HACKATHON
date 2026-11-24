import { describe, expect, it } from "vitest";
import { planText, ruleBasedPlan } from "./index";
import { cleanTitle, prepKind } from "./kind";
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
    expect(p.glance.what).toBe("(주)면사랑 현장 면접 참여");
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
  it("질문 원문이 화면·복사 텍스트 어디에도 없습니다", () => {
    const text = JSON.stringify(p) + planText(p, (EVENT as { opportunity: never }).opportunity);
    expect(text).not.toMatch(/살고 있습니까|필요합니까|→ 예|제 상황\(/);
  });
});

describe("신청 준비 — 유형별", () => {
  it("나이 조건이 내 답보다 높으면 대상 아님(block)", () => {
    const p = ruleBasedPlan(match({ domain: "benefit", title: "신중년 재취업 수당", org: "○○시", summary: "", conditions: [{ attr: "age", op: "gte", value: 50, rawText: "만 50세 이상", confidence: "high" }] }), ANSWERS);
    expect(p.target.level).toBe("block");
  });
  it("지원금: 공고 서류·소득 서류·금액 구절·서류 발급 일정", () => {
    const ans = [...ANSWERS, q("livingAlone", "eq", true, "혼자 살고 있습니까?", "yes"), q("incomePct", "lte", 60, "소득 60% 이하입니까?", "yes")];
    const p = ruleBasedPlan(match({ domain: "benefit", title: "서울시 청년월세 지원", org: "서울특별시", summary: "월 최대 20만 원 지원. 임대차계약서 사본을 제출합니다.", applyEnd: "2026-12-10",
      conditions: [{ attr: "incomePct", op: "lte", value: 150, rawText: "기준중위소득 150% 이하", confidence: "high" }] }), ans, new Date("2026-11-23"));
    expect(p.kind).toBe("benefit_cash");
    expect(p.docs[0]).toMatchObject({ name: "임대차계약서 사본", src: "posting" });
    expect(p.docs.some((d) => d.name === "건강보험료 납부확인서")).toBe(true);
    expect(p.rows[0]).toMatchObject({ mine: "기준중위소득 60% 이하", verdict: "ok" });
    expect(p.glance.what).toBe("월 최대 20만 원 지원");
    expect(p.steps[1].when).toBe("12/5까지");
  });
  it("유형 판별과 제목 정리", () => {
    expect(prepKind({ domain: "job", title: "청년 일자리 박람회", org: "○○구", source: "x" })).toBe("job_event");
    expect(prepKind({ domain: "housing", title: "공공분양 청약", org: "LH", source: "x" })).toBe("housing_sale");
    expect(cleanTitle("12_(수요데이) 테스트 행사")).toEqual({ title: "테스트 행사", series: "수요데이", num: "12" });
    expect(cleanTitle("2026 체험형 청년인턴").title).toBe("2026 체험형 청년인턴");
  });
});

describe("대상 판정", () => {
  const NOW = new Date("2026-11-23T10:00:00");
  const base = { domain: "benefit", title: "청년 지원금", org: "○○시", summary: "", applyEnd: "2026-12-31" };
  it("확인할 조건이 남으면 초록(ok)이 아니라 check", () => {
    const p = ruleBasedPlan(match(base, { status: "needs_check", unknowns: [{ attr: "incomePct", op: "lte", value: 60, rawText: "기준중위소득 60% 이하", confidence: "high" }] }), ANSWERS, NOW);
    expect(p.target.level).toBe("check");
  });
  it("다른 지역 한정 공고는 block, '서울특별시'·'전국'은 통과", () => {
    expect(ruleBasedPlan(match({ ...base, region: ["부산"] }), ANSWERS, NOW).target.level).toBe("block");
    expect(ruleBasedPlan(match({ ...base, region: ["서울특별시"] }), ANSWERS, NOW).target.level).toBe("ok");
    const nat = ruleBasedPlan(match({ ...base, region: ["전국"] }), ANSWERS, NOW);
    expect(nat.target.level).toBe("ok");
    expect(nat.rows.some((r) => r.cond.startsWith("지역"))).toBe(false);
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
});

describe("한눈에 '내용' 문장", () => {
  it("금액만 쓰지 않고 목적(지원·채용 등)을 함께 적습니다", async () => {
    const { contentLine } = await import("./index");
    const sum = "무주택 청년 1인 가구에 월 최대 20만 원, 최대 12개월 지원. 임대차계약서 사본을 제출합니다.";
    expect(contentLine("benefit_cash", sum, sum.split(/(?<=[.])\s+/))).toBe("무주택 청년 1인 가구에 월 최대 20만 원, 최대 12개월 지원");
    expect(contentLine("benefit_cash", "월 30만 원", ["월 30만 원"])).toBe("월 30만 원 지원");
    expect(contentLine("job", "통계 자료 정리, 보고서 작성 보조.", ["통계 자료 정리, 보고서 작성 보조."])).toBe("채용 · 통계 자료 정리, 보고서 작성 보조");
  });
});
