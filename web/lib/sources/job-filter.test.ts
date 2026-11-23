import { describe, expect, it } from "vitest";
import { inferJobConditions } from "./index";
import { applyAnswer, getMatches, startGame } from "@/lib/engine";
import type { Opportunity } from "@/lib/types";

const job = (id: string, title: string, org = "셀트리온제약"): Opportunity => ({ id, title, org, domain: "job", region: [], conditions: [], isSample: false, origin: "api", apply: {} } as unknown as Opportunity);
const pool = [
  job("it-exp", "셀트리온제약 IT 분야 경력채용 (서버/Cloud 엔지니어, 정보보안담당자)"),
  job("ma-exp", "셀트리온제약 제품개발 분야 경력채용 (허가, MA)"),
  job("dds-exp", "셀트리온제약 연구소 약물전달기술 분야 채용 (경력)"),
  job("dds-new", "셀트리온제약 연구소 약물전달기술 분야 채용 (신입)"),
  job("it-new", "셀트리온제약 IT 분야 신입/경력 채용 (전산)"),
  job("elec-new", "전기설비 유지보수 신입 채용"),
  job("art", "서서울미술관 학예 기간제 채용"),
  job("plain", "청년 인턴 모집", "한국청년재단"),
  job("org-pharma", "신입 및 경력사원 모집", "동화약품"),
  job("open", "2027 상반기 대졸 신입사원 공개채용", "케이티텔레캅"),
  job("pro-unknown", "본사 경력직 채용", "오리온"),
].map(inferJobConditions);

describe("채용 공고 경력·직무 판별", () => {
  it("분야를 알 수 없는 공고는 일반 채용(직무 무관)과 전문 조건 공고(분야 미표기)로 나눕니다", () => {
    const field = (id: string) => pool.find((o) => o.id === id)!.conditions.find((c) => c.attr === "field")!.value;
    expect(field("open")).toEqual(["직무 무관"]);
    expect(field("pro-unknown")).toEqual(["분야 미표기"]);
    expect(field("plain")).toEqual(["직무 무관"]);
  });

  it("경력 전용 공고에만 경력 조건을 붙입니다(신입·경력 병기는 제외)", () => {
    const exp = (id: string) => pool.find((o) => o.id === id)!.conditions.some((c) => c.attr === "experienced");
    expect(["it-exp", "ma-exp", "dds-exp"].every(exp)).toBe(true);
    expect(["dds-new", "it-new", "elec-new", "plain", "org-pharma"].some(exp)).toBe(false);
  });

  it("IT·전기 희망 + 경력 없음이면 경력 전용·무관 직무 공고가 빠집니다", () => {
    const run = (unspecified: "yes" | "no") => {
    let s = startGame(pool);
    const fieldQ = (v: string) => ({ id: `field:in:${v}`, attr: "field", op: "in", value: [v], text: "어떤 분야 일을 원하십니까?" }) as never;
    for (const f of ["정보통신", "전기·전자"]) s = applyAnswer(s, fieldQ(f), "yes");
    for (const f of ["화학·바이오", "문화·예술·디자인·방송", "교육·자연·사회과학"]) s = applyAnswer(s, fieldQ(f), "no");
    s = applyAnswer(s, fieldQ("분야 미표기"), unspecified);
    s = applyAnswer(s, fieldQ("직무 무관"), unspecified);
    s = applyAnswer(s, { id: "experienced:eq:true", attr: "experienced", op: "eq", value: true, text: "관련 경력이 있습니까?" } as never, "no");
    return getMatches(s).map((m) => m.opportunity.id).sort();
    };
    // 직무가 적히지 않은 공고(plain)는 "직무 미표기 공고도 보기"를 고르지 않으면 빠진다
    expect(run("no")).toEqual(["elec-new", "it-new"]);
    // 일반 채용까지 보겠다고 하면 직무 무관 공고가 더해진다(경력 전용은 여전히 제외)
    expect(run("yes")).toEqual(["elec-new", "it-new", "open", "plain"]);
  });
});
