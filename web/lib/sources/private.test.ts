import { afterEach, describe, expect, it, vi } from "vitest";
import { mapApplyhome, applyhome } from "./applyhome";
import { mapSaramin, saramin } from "./saramin";

const NOW = new Date("2026-11-21T03:00:00Z");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("청약홈 분양정보", () => {
  it("APT 공고를 주거 공고로 매핑(지역·마감·원문 링크, 무주택은 낮은 신뢰도)", () => {
    const [o] = mapApplyhome({ data: [{
      HOUSE_MANAGE_NO: "2026001", PBLANC_NO: "2026001", HOUSE_NM: "청년힐스", SUBSCRPT_AREA_CODE_NM: "서울",
      HSSPLY_ADRES: "서울특별시 강서구", RCEPT_BGNDE: "2026-11-25", RCEPT_ENDDE: "2026-11-27",
      PBLANC_URL: "https://www.applyhome.co.kr/x", HOUSE_DTL_SECD_NM: "민영", TOT_SUPLY_HSHLDCO: 120,
    }] }, "apt", NOW);
    expect(o).toMatchObject({ domain: "housing", region: ["서울"], applyEnd: "2026-11-27", url: "https://www.applyhome.co.kr/x", isSample: false });
    expect(o.title).toContain("APT 분양");
    expect(o.conditions).toContainEqual(expect.objectContaining({ attr: "homeless", confidence: "low" }));
  });
  it("무순위는 SUBSCRPT_RCEPT_ENDDE(YYYYMMDD)를 읽고 무주택 조건을 붙이지 않는다", () => {
    const [o] = mapApplyhome({ data: [{ HOUSE_MANAGE_NO: "1", PBLANC_NO: "1", HOUSE_NM: "잔여", HSSPLY_ADRES: "경기도 수원시", SUBSCRPT_RCEPT_ENDDE: "20261130" }] }, "remndr", NOW);
    expect(o.applyEnd).toBe("2026-11-30");
    expect(o.region).toEqual(["경기"]);
    expect(o.conditions.some((c) => c.attr === "homeless")).toBe(false);
  });
  it("일부 종류만 실패해도 나머지는 반환", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "k");
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (n++ === 0
      ? new Response(JSON.stringify({ data: [{ HOUSE_MANAGE_NO: "1", PBLANC_NO: "1", HOUSE_NM: "A", HSSPLY_ADRES: "부산 해운대구", RCEPT_ENDDE: "2026-12-01" }] }))
      : new Response("err", { status: 401 }))));
    expect(await applyhome.fetch(NOW)).toHaveLength(1);
  });
});

describe("사람인(기본 OFF)", () => {
  it("SARAMIN_ENABLED 없으면 호출하지 않는다", async () => {
    vi.stubEnv("SARAMIN_KEY", "k");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await saramin.fetch(NOW)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it("공고를 채용 공고로 매핑하고 출처를 표기", () => {
    const [o] = mapSaramin({ jobs: { job: [{
      id: "123", active: 1, url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123",
      company: { detail: { name: "에이비" } }, "expiration-timestamp": 1764428400,
      position: { title: "주니어 개발자", location: { name: "서울 &gt; 강남구" }, "experience-level": { name: "신입" }, "job-type": { name: "정규직" } },
    }] } }, NOW);
    expect(o).toMatchObject({ domain: "job", region: ["서울"], source: "saramin" });
    expect(o.org).toContain("사람인 제공");
    expect(o.applyEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
