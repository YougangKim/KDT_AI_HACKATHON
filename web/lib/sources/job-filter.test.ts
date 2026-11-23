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
].map(inferJobConditions);

describe("채용 공고 경력·직무 판별", () => {
  it("경력 전용 공고에만 경력 조건을 붙입니다(신입·경력 병기는 제외)", () => {
    const exp = (id: string) => pool.find((o) => o.id === id)!.conditions.some((c) => c.attr === "experienced");
    expect(["it-exp", "ma-exp", "dds-exp"].every(exp)).toBe(true);
    expect(["dds-new", "it-new", "elec-new", "plain", "org-pharma"].some(exp)).toBe(false);
  });

  it("IT·전기 희망 + 경력 없음이면 경력 전용·무관 직무 공고가 빠집니다", () => {
    let s = startGame(pool);
    const fieldQ = (v: string) => ({ id: `field:in:${v}`, attr: "field", op: "in", value: [v], text: "어떤 분야 일을 원하십니까?" }) as never;
    for (const f of ["정보통신", "전기·전자"]) s = applyAnswer(s, fieldQ(f), "yes");
    for (const f of ["화학·바이오", "문화·예술·디자인·방송", "교육·자연·사회과학"]) s = applyAnswer(s, fieldQ(f), "no");
    s = applyAnswer(s, { id: "experienced:eq:true", attr: "experienced", op: "eq", value: true, text: "관련 경력이 있습니까?" } as never, "no");
    const ids = getMatches(s).map((m) => m.opportunity.id).sort();
    expect(ids).toEqual(["elec-new", "it-new", "plain"]);
  });
});
