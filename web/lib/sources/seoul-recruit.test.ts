import { expect, it } from "vitest";
import { mapSeoulRecruit } from "./seoul-recruit";

it("서울시 채용시험: 마감 전 모집 공고만, 결과 발표 글 제외, 서울 지역", () => {
  const rows = [
    { BOARD_ID: 1, TITLE: "2026년 서울공예박물관 임기제공무원 채용 공고", DEADLINE_DATE: "20261205", RECRUIT_GUBUN: "공무원", ORGAN: "서울시", CONTENTS: "모집" },
    { BOARD_ID: 2, TITLE: "서류심사 결과 발표", DEADLINE_DATE: "20261205" },
    { BOARD_ID: 3, TITLE: "지난 공고", DEADLINE_DATE: "20261101" },
  ];
  const list = mapSeoulRecruit(rows, new Date("2026-11-23T00:00:00Z"));
  expect(list.map((o) => o.id)).toEqual(["seoul-recruit:1"]);
  expect(list[0]).toMatchObject({ domain: "job", region: ["서울"], applyEnd: "2026-12-05" });
});
