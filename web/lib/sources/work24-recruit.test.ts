import { describe, expect, it } from "vitest";
import { mapJobEvents, mapOpenRecruit } from "./work24-recruit";

const NOW = new Date("2026-11-23T00:00:00Z");

describe("고용24 공채속보·채용행사", () => {
  it("공채속보: 마감 전 공고만, 기업명+제목, 채용 페이지 링크", () => {
    const xml = `<dhsOpenEmpInfoList><total>2</total><dhsOpenEmpInfo><empSeqno>1</empSeqno><empWantedTitle>2027년 공개채용</empWantedTitle><empBusiNm>국방과학연구소</empBusiNm><coClcdNm>공공기관</coClcdNm><empWantedStdt>20261118</empWantedStdt><empWantedEndt>20261202</empWantedEndt><empWantedTypeNm>정규직|기간제</empWantedTypeNm><empWantedHomepgDetail>https://add.applyin.co.kr/jobs/</empWantedHomepgDetail></dhsOpenEmpInfo><dhsOpenEmpInfo><empSeqno>2</empSeqno><empWantedTitle>지난 공고</empWantedTitle><empBusiNm>A</empBusiNm><empWantedEndt>20261101</empWantedEndt></dhsOpenEmpInfo></dhsOpenEmpInfoList>`;
    const list = mapOpenRecruit(xml, NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "work24-recruit:1", domain: "job", title: "국방과학연구소 2027년 공개채용", applyEnd: "2026-12-02", url: "https://add.applyin.co.kr/jobs/" });
    expect(list[0].summary).toContain("정규직·기간제");
  });
  it("채용행사: 끝나지 않은 행사만", () => {
    const xml = `<empEvList><empEvent><area>서울/강원 지역</area><eventNo>9</eventNo><eventNm>★ 일자리 수요데이 ★</eventNm><eventTerm>2026-12-16 ~ 2026-12-16</eventTerm><startDt>2026-12-16</startDt></empEvent><empEvent><eventNo>8</eventNo><eventNm>지난 행사</eventNm><eventTerm>2026-10-01 ~ 2026-10-02</eventTerm></empEvent></empEvList>`;
    const list = mapJobEvents(xml, NOW);
    expect(list.map((o) => o.id)).toEqual(["work24-event:9"]);
    expect(list[0]).toMatchObject({ title: "일자리 수요데이", applyEnd: "2026-12-16" });
  });
});
