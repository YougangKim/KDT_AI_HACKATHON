import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "../types";
import { mapLhNotice } from "./lh-notice";
import { mapMyhome } from "./myhome";
import { mapJobalio } from "./jobalio";
import { mapGov24 } from "./gov24";
import { mapYouthcenter } from "./youthcenter";
import { mapWork24Training } from "./work24-training";
import { mapQnet } from "./qnet";
import { ALL_DOMAINS, _clearCache, loadOpportunities, parseDomains } from "./index";
import housing from "../../data/samples/housing.json";
import job from "../../data/samples/job.json";
import parttime from "../../data/samples/parttime.json";
import benefit from "../../data/samples/benefit.json";
import training from "../../data/samples/training.json";
import exam from "../../data/samples/exam.json";
const SAMPLES = { housing, job, parttime, benefit, training, exam } as Record<(typeof ALL_DOMAINS)[number], Opportunity[]>;
import { parsePeriod, toIsoDate, toRegions } from "./util";

const NOW = new Date("2026-11-21T03:00:00Z");
const ATTRS = ["age", "region", "homeless", "livingAlone", "incomePct", "employment", "interest"];

function expectValid(o: Opportunity) {
  expect(o.id.startsWith(`${o.source}:`)).toBe(true);
  expect(ALL_DOMAINS).toContain(o.domain);
  expect(o.title).toBeTruthy();
  expect(o.url).toMatch(/^https?:\/\//);
  for (const c of o.conditions) expect(ATTRS).toContain(c.attr);
  if (o.applyEnd) expect(o.applyEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}

describe("util", () => {
  it("날짜 형식을 ISO로", () => {
    expect(toIsoDate("20261130")).toBe("2026-11-30");
    expect(toIsoDate("2026.11.3")).toBe("2026-11-03");
    expect(toIsoDate("2026-12-01 10:00")).toBe("2026-12-01");
    expect(toIsoDate("상시")).toBeUndefined();
    expect(parsePeriod("20261101 ~ 20261130")).toEqual(["2026-11-01", "2026-11-30"]);
  });
  it("지역 표기를 시도 약칭으로", () => {
    expect(toRegions("서울특별시,경기도")).toEqual(["서울", "경기"]);
    expect(toRegions("전국")).toEqual([]);
    expect(toRegions("전라남도")).toEqual(["전남"]);
  });
});

describe("어댑터 매핑", () => {
  it("LH 분양임대공고", () => {
    const raw = [
      { dsSch: [{ PG_SZ: "50" }] },
      { dsList: [{ PAN_ID: "2015122300019999", PAN_NM: "[청년] 서울 행복주택 입주자 모집", CNP_CD_NM: "서울특별시", UPP_AIS_TP_NM: "임대주택", AIS_TP_CD_NM: "행복주택", PAN_SS: "공고중", PAN_NT_ST_DT: "2026.11.20", CLSG_DT: "2026.12.04", DTL_URL: "https://apply.lh.or.kr/x" }] },
    ];
    const [o] = mapLhNotice(raw, NOW);
    expectValid(o);
    expect(o).toMatchObject({ id: "lh-notice:2015122300019999", domain: "housing", region: ["서울"], applyStart: "2026-11-20", applyEnd: "2026-12-04", isSample: false });
    expect(o.conditions).toContainEqual(expect.objectContaining({ attr: "region", op: "in", value: ["서울"] }));
  });

  it("마이홈 공공주택 모집공고", () => {
    const raw = { response: { body: { item: [{ pblancId: "123", pblancNm: "인천 행복주택", suplyInsttNm: "인천도시공사", brtcNm: "인천광역시", beginDe: "20261125", endDe: "20261205", pcUrl: "https://www.myhome.go.kr/x" }] } } };
    const [o] = mapMyhome(raw, NOW);
    expectValid(o);
    expect(o).toMatchObject({ id: "myhome:123", org: "인천도시공사", region: ["인천"], applyEnd: "2026-12-05" });
  });

  it("잡알리오 채용(자격요건 규칙 구조화)", () => {
    const raw = { resultCode: 200, result: [{ recrutPblntSn: 999, instNm: "한국전력공사", recrutPbancTtl: "2026년 체험형 청년인턴", workRgnNmLst: "전라남도", hireTypeNmLst: "청년인턴(체험형)", recrutSeNm: "신입", pbancBgngYmd: "20261118", pbancEndYmd: "20261201", aplyQlfcCn: "만 34세 이하 미취업자", srcUrl: "https://job.alio.go.kr/x" }] };
    const [o] = mapJobalio(raw, NOW);
    expectValid(o);
    expect(o.region).toEqual([]);
    expect(o.summary).toContain("근무지 전남");
    expect(o.conditions).toContainEqual(expect.objectContaining({ attr: "age", op: "lte", value: 34 }));
    expect(o.conditions).toContainEqual(expect.objectContaining({ attr: "employment", value: ["jobseeker"] }));
  });

  it("공공서비스(혜택) — 지자체는 지역, 상시는 마감 없음", () => {
    const raw = { data: [
      { 서비스ID: "A1", 서비스명: "서울 청년 월세 지원", 소관기관명: "서울특별시", 지원대상: "만 19세~39세 무주택 청년, 기준중위소득 150% 이하", 신청기한: "2026-11-01 ~ 2026-12-10", 상세조회URL: "https://www.gov.kr/x" },
      { 서비스ID: "B2", 서비스명: "청년 마음건강", 소관기관명: "보건복지부", 지원대상: "청년", 신청기한: "상시신청", 상세조회URL: "https://www.gov.kr/y" },
    ] };
    const [a, b] = mapGov24(raw, NOW);
    expectValid(a);
    expect(a.region).toEqual(["서울"]);
    expect(a.applyEnd).toBe("2026-12-10");
    expect(a.conditions.map((c) => c.attr)).toEqual(expect.arrayContaining(["age", "homeless", "incomePct", "region"]));
    expect(b.region).toEqual([]);
    expect(b.applyEnd).toBeUndefined();
  });

  it("온통청년 — 분류로 분야 결정, 나이 필드 사용", () => {
    const raw = { result: { youthPolicyList: [{ plcyNo: "P1", plcyNm: "청년 전세보증금 이자지원", lclsfNm: "주거", sprvsnInstCdNm: "부산광역시", rgtrUpInstCdNm: "부산광역시", sprtTrgtMinAge: "19", sprtTrgtMaxAge: "39", sprtTrgtAgeLmtYn: "Y", aplyYmd: "20261101 ~ 20261220", aplyUrlAddr: "https://www.youthcenter.go.kr/x" }] } };
    const [o] = mapYouthcenter(raw, NOW);
    expectValid(o);
    expect(o).toMatchObject({ domain: "housing", region: ["부산"], applyStart: "2026-11-01", applyEnd: "2026-12-20" });
    expect(o.conditions.filter((c) => c.attr === "age").map((c) => c.value)).toEqual([19, 39]);
  });

  it("고용24 훈련과정 — 개강 전날을 마감으로", () => {
    const raw = { srchList: [{ trprId: "AIG2026", trprDegr: "3", title: "AI 서비스 개발자 양성", subTitle: "OO아카데미", address: "서울 강남구", traStartDate: "2026-12-15", trainTarget: "K-디지털 트레이닝", titleLink: "https://www.work24.go.kr/x" }] };
    const [o] = mapWork24Training(raw, NOW);
    expectValid(o);
    expect(o).toMatchObject({ id: "work24-training:AIG2026-3", applyEnd: "2026-12-14", region: [] });
  });

  it("Q-Net 시험일정 — 필기·실기 접수를 각각", () => {
    const raw = { body: { items: [{ implYy: "2026", implSeq: "4", qualgbCd: "T", qualgbNm: "국가기술자격", description: "국가기술자격 정기 기사 4회", docRegStartDt: "20261124", docRegEndDt: "20261127", docExamStartDt: "20261213", pracRegStartDt: "", pracRegEndDt: "" }] } };
    const list = mapQnet(raw, NOW);
    expect(list).toHaveLength(1);
    expectValid(list[0]);
    expect(list[0]).toMatchObject({ domain: "exam", applyEnd: "2026-11-27", title: "국가기술자격 정기 기사 4회 필기 원서접수" });
  });

  it("이상한 응답은 빈 배열", () => {
    expect(mapLhNotice(null, NOW)).toEqual([]);
    expect(mapJobalio({ resultCode: 500 }, NOW)).toEqual([]);
    expect(mapGov24("<xml/>", NOW)).toEqual([]);
  });
});

describe("샘플 데이터", () => {
  it.each(ALL_DOMAINS)("%s 8~15건, 형식 유효, isSample", (d) => {
    const list = SAMPLES[d];
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(list.length).toBeLessThanOrEqual(15);
    for (const o of list) {
      expectValid(o);
      expect(o.domain).toBe(d);
      expect(o.isSample).toBe(true);
      if (o.applyEnd) expect(o.applyEnd >= "2026-11-01" && o.applyEnd <= "2026-12-31").toBe(true);
    }
  });
  it("id 중복 없음", () => {
    const ids = ALL_DOMAINS.flatMap((d) => SAMPLES[d].map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("loadOpportunities", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    _clearCache();
    delete process.env.DATA_GO_KR_KEY;
    delete process.env.YOUTHCENTER_KEY;
    delete process.env.WORK24_TRAINING_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SARAMIN_API_KEY;
    delete process.env.WEB_SEARCH_ENABLED;
    delete process.env.SH_RSS_ENABLED;
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("키 없으면 샘플 없이 빈 결과", async () => {
    const list = await loadOpportunities(undefined, NOW);
    expect(list).toEqual([]);
  });

  it("분야 필터와 마감 지난 공고 제외", async () => {
    const later = new Date("2026-12-11T03:00:00Z");
    const list = await loadOpportunities(["housing"], later);
    expect(list.every((o) => o.domain === "housing")).toBe(true);
    expect(list.every((o) => !o.applyEnd || o.applyEnd >= "2026-12-11")).toBe(true);
  });

  it("API 실패 시 샘플 없이 빈 결과", async () => {
    process.env.DATA_GO_KR_KEY = "test";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const list = await loadOpportunities(["job"], NOW);
    expect(list).toEqual([]);
  });

  it("키가 있고 응답이 오면 실데이터 사용", async () => {
    process.env.DATA_GO_KR_KEY = "test";
    const body = { resultCode: 200, result: [{ recrutPblntSn: 1, instNm: "기관", recrutPbancTtl: "청년인턴", pbancEndYmd: "20261210", srcUrl: "https://job.alio.go.kr/1" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    const list = await loadOpportunities(["job"], NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "jobalio:1", isSample: false });
  });

  it("parseDomains", () => {
    expect(parseDomains("housing,benefit,foo")).toEqual(["housing", "benefit"]);
    expect(parseDomains("foo")).toEqual(ALL_DOMAINS);
    expect(parseDomains(null)).toEqual(ALL_DOMAINS);
  });
});
