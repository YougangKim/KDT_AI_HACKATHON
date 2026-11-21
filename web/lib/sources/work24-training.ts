// 국민내일배움카드 훈련과정 (고용24 OpenAPI). data.go.kr 15109032는 LINK형이라 고용24에서 별도 인증키 발급
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, pickArray, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do";

/** 목록 API에는 모집 마감일이 없어 개강일 전날을 마감으로 본다 */
function dayBefore(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export function mapWork24Training(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["srchList"], ["returnJSON", "srchList"]]);
  return items
    .filter((r) => str(r.title))
    .map((r) => {
      const title = str(r.title);
      const place = toRegions(str(r.address).split(" ")[0]);
      const start = toIsoDate(r.traStartDate);
      return {
        id: `work24-training:${str(r.trprId) || title}-${str(r.trprDegr)}`,
        domain: "training" as const,
        title,
        org: str(r.subTitle) || "훈련기관",
        region: [], // 훈련 장소는 자격이 아니다
        summary: [str(r.trainTarget), place.length ? `훈련장소 ${place.join("·")}` : "", start && `개강 ${start}`].filter(Boolean).join(" / "),
        conditions: buildConditions("training", [], str(r.trainTarget)),
        applyEnd: dayBefore(start),
        url: str(r.titleLink) || "https://www.work24.go.kr/",
        source: "work24-training",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
    });
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export const work24Training: SourceAdapter = {
  id: "work24-training",
  domains: ["training"],
  envKey: "WORK24_TRAINING_KEY",
  async fetch(now) {
    const key = process.env.WORK24_TRAINING_KEY!;
    const end = new Date(now.getTime() + 60 * 86400_000);
    const url = `${ENDPOINT}?authKey=${encodeURIComponent(key)}&returnType=JSON&outType=1&pageNum=1&pageSize=50&srchTraStDt=${ymd(now)}&srchTraEndDt=${ymd(end)}&sort=ASC&sortCol=TRNG_BGDE`;
    return mapWork24Training(await fetchJson(url), now);
  },
};
