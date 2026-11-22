// 마이홈포털 공공주택 모집공고 (국토교통부, data.go.kr) — 엔드포인트는 키 발급 후 상세 페이지에서 재확인 필요
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, pickArray, str, toIsoDate, toRegions } from "./util";

const ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList";

export function mapMyhome(raw: unknown, now: Date): Opportunity[] {
  const items = pickArray(raw, [["response", "body", "item"], ["response", "body", "items", "item"]]);
  return items
    .filter((r) => str(r.pblancNm))
    .map((r) => {
      const title = str(r.pblancNm);
      const region = toRegions(r.brtcNm);
      const url = str(r.pcUrl) || str(r.url) || "https://apply.lh.or.kr/";
      return {
        id: `myhome:${str(r.pblancId) || title}`,
        domain: "housing" as const,
        title,
        org: str(r.suplyInsttNm) || "마이홈포털",
        region,
        summary: [str(r.houseTyNm), str(r.suplyTyNm), str(r.hsmpNm), str(r.fullAdres)].filter(Boolean).join(" / ") || "공공주택 모집공고",
        conditions: buildConditions("housing", region, [title, str(r.suplyTyNm)].join(" ")),
        applyStart: toIsoDate(r.beginDe),
        applyEnd: toIsoDate(r.endDe),
        apply: { how: "LH청약플러스에서 온라인 신청", url },
        place: str(r.fullAdres) || str(r.hsmpNm) || undefined,
        url,
        source: "myhome",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
    });
}

export const myhome: SourceAdapter = {
  id: "myhome",
  domains: ["housing"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = process.env.DATA_GO_KR_KEY!;
    const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=50`;
    return mapMyhome(await fetchJson(url), now);
  },
};
