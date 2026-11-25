// 서울 열린데이터광장 "서울시 채용시험"(OA-23005, recruitTest): 서울시·산하기관 채용 공고(일자리포털 공공일자리 pjMg와 겹쳐 이것만 쓴다)
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, str, toIsoDate } from "./util";
import { workplaceValues } from "../geo/workplace";

const SERVICE = "recruitTest";
const PAGE = 1000;

export function mapSeoulRecruit(rows: Record<string, unknown>[], now: Date): Opportunity[] {
  const today = now.toISOString().slice(0, 10);
  return rows
    .filter((r) => str(r.TITLE) && !/결과|합격자|발표/.test(str(r.TITLE)))
    .map((r) => {
      const title = str(r.TITLE);
      const end = toIsoDate(str(r.DEADLINE_DATE).slice(0, 8));
      const kind = str(r.RECRUIT_GUBUN);
      const parttime = /아르바이트|단기|시간제/.test(title);
      const domain = parttime ? ("parttime" as const) : ("job" as const);
      // 본문 앞 80자만 요약에 남기므로, 본문의 "근무지·근무장소" 라벨 값은 따로 남겨 지도·지역 근거로 쓴다
      const work = workplaceValues(str(r.CONTENTS))[0];
      return {
        id: `seoul-recruit:${str(r.BOARD_ID) || title}`,
        domain,
        title,
        org: str(r.ORGAN) || "서울시",
        region: ["서울"],
        summary: [kind && kind !== "기타" ? kind : "", end && `마감 ${end}`, work && `근무지 ${work}`, str(r.CONTENTS).replace(/\s+/g, " ").slice(0, 80)].filter(Boolean).join(" / "),
        conditions: buildConditions(domain, ["서울"], ""),
        applyEnd: end,
        apply: { how: "서울시 채용 공고 원문에서 접수 방법 확인", url: "https://www.seoul.go.kr/news/news_recruit.do" },
        url: `https://www.seoul.go.kr/news/news_recruit.do#view/${str(r.BOARD_ID)}`,
        source: "seoul-recruit",
        isSample: false,
        fetchedAt: now.toISOString(),
      } satisfies Opportunity;
    })
    .filter((o) => !!o.applyEnd && o.applyEnd >= today);
}

export const seoulRecruit: SourceAdapter = {
  id: "seoul-recruit",
  domains: ["job", "parttime"],
  envKey: "SEOUL_OPEN_API_KEY",
  async fetch(now, options = {}) {
    const key = process.env.SEOUL_OPEN_API_KEY!;
    // 최신 글이 앞에 오므로 앞쪽 몇 쪽만(마감 지난 글이 대부분). 일괄 수집은 3쪽, 화면 폴백은 1쪽
    const pages = options.full ? 3 : 1;
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < pages; i++) {
      options.onRequest?.();
      const raw = await fetchJson(`http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/${SERVICE}/${i * PAGE + 1}/${(i + 1) * PAGE}/`, 15000) as Record<string, { row?: Record<string, unknown>[] }>;
      const list = raw[SERVICE]?.row ?? [];
      rows.push(...list);
      if (list.length < PAGE) break;
    }
    return mapSeoulRecruit(rows, now);
  },
};
