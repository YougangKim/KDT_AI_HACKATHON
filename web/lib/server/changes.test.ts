import { describe, expect, it } from "vitest";
import { detectChanges, pushSummary } from "./changes";
import { dedupeOpportunities } from "../sources/dedupe";
import type { Opportunity } from "../types";

const opp = (id: string, applyEnd?: string, extra: Partial<Opportunity> = {}): Opportunity => ({
  id, domain: "housing", title: `공고 ${id}`, org: "LH", region: [], summary: "", conditions: [],
  applyEnd, url: `https://x/${id}`, source: "lh", isSample: false, fetchedAt: "", ...extra,
});
const now = new Date("2026-11-21T00:00:00+09:00");

describe("마감 변경·임박 감지", () => {
  it("처음 본 공고는 변경으로 치지 않고, 마감일이 바뀌면 알린다", () => {
    const first = detectChanges([opp("a", "2026-12-31")], {}, now);
    expect(first.changed).toEqual([]);
    const second = detectChanges([opp("a", "2027-01-15")], first.known, now);
    expect(second.changed).toHaveLength(1);
    expect(second.changed[0]).toMatchObject({ from: "2026-12-31", to: "2027-01-15" });
  });
  it("D-3 이내 임박은 공고당 한 번만 알린다", () => {
    const r1 = detectChanges([opp("b", "2026-11-23")], {}, now);
    expect(r1.soon.map((o) => o.id)).toEqual(["b"]);
    const r2 = detectChanges([opp("b", "2026-11-23")], r1.known, now);
    expect(r2.soon).toEqual([]);
    expect(detectChanges([opp("c", "2026-12-31")], {}, now).soon).toEqual([]);
  });
  it("푸시는 한 건으로 묶는다", () => {
    const s = pushSummary([opp("n")], { changed: [{ opp: opp("a") }], soon: [opp("b")] });
    expect(s.title).toBe("새 공고 1건 · 마감 변경 1건 · 마감 임박 1건");
  });
});

describe("중복 공고 정리", () => {
  it("괄호·공백이 달라도 같은 공고는 하나만, 공식 API를 남긴다", () => {
    const list = [
      opp("w", undefined, { title: "[모집] 2026 청년 매입임대 입주자 모집", origin: "websearch", source: "websearch" }),
      opp("api", undefined, { title: "2026 청년 매입임대 입주자 모집" }),
      opp("other", undefined, { title: "행복주택 모집" }),
    ];
    expect(dedupeOpportunities(list).map((o) => o.id)).toEqual(["api", "other"]);
  });
  it("같은 출처의 제목 같은 공고(회차만 괄호로 다름)는 합치지 않는다", () => {
    const list = [
      opp("q1", "2026-11-27", { title: "기능사 (제107회) 실기 원서접수", source: "qnet" }),
      opp("q2", "2026-12-20", { title: "기능사 (제108회) 실기 원서접수", source: "qnet" }),
    ];
    expect(dedupeOpportunities(list)).toHaveLength(2);
  });
});
