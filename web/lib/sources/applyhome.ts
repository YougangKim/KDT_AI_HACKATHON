// 한국부동산원 청약홈 분양정보 조회 서비스 (data.go.kr 15098547, api.odcloud.kr)
// 민영·국민 APT 분양, 무순위/잔여세대, 오피스텔·도시형·민간임대 공고. data.go.kr에서 별도 활용신청 필요(자동승인).
// 자격(청약통장·소득·자산)은 공고문에만 있어 지역·접수기간만 판정하고 나머지는 "확인 필요"로 둔다.
import type { Condition, Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, pickArray, str, toIsoDate, toRegions, todayKst } from "./util";

const BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";

type Kind = "apt" | "remndr" | "urbty";
const OPS: Record<Kind, { op: string; label: string; endKey: string; startKey: string }> = {
  apt: { op: "getAPTLttotPblancDetail", label: "APT 분양", endKey: "RCEPT_ENDDE", startKey: "RCEPT_BGNDE" },
  remndr: { op: "getRemndrLttotPblancDetail", label: "무순위·잔여세대", endKey: "SUBSCRPT_RCEPT_ENDDE", startKey: "SUBSCRPT_RCEPT_BGNDE" },
  urbty: { op: "getUrbtyOfctlLttotPblancDetail", label: "오피스텔·민간임대", endKey: "SUBSCRPT_RCEPT_ENDDE", startKey: "SUBSCRPT_RCEPT_BGNDE" },
};

// 청약 1순위·특별공급은 대개 무주택 요건이 있지만 공고마다 달라 낮은 신뢰도로 둔다(맞지 않아도 탈락시키지 않음)
const HOMELESS_HINT: Condition = { attr: "homeless", op: "eq", value: true, rawText: "청약 자격(무주택 등)은 공고문 확인", confidence: "low" };

export function mapApplyhome(raw: unknown, kind: Kind, now: Date): Opportunity[] {
  const { label, endKey, startKey } = OPS[kind];
  return pickArray(raw, [["data"]])
    .filter((r) => str(r.HOUSE_NM))
    .map((r) => {
      const region = toRegions(str(r.SUBSCRPT_AREA_CODE_NM) || str(r.HSSPLY_ADRES).split(" ")[0]);
      const end = toIsoDate(r[endKey]) ?? toIsoDate(r.RCEPT_ENDDE);
      const start = toIsoDate(r[startKey]) ?? toIsoDate(r.RCEPT_BGNDE);
      const type = str(r.HOUSE_DTL_SECD_NM) || str(r.HOUSE_SECD_NM);
      const units = str(r.TOT_SUPLY_HSHLDCO);
      const url = str(r.PBLANC_URL) || "https://www.applyhome.co.kr";
      return {
        id: `applyhome:${str(r.HOUSE_MANAGE_NO)}:${str(r.PBLANC_NO)}`,
        domain: "housing" as const,
        title: `[${label}] ${str(r.HOUSE_NM)}`,
        org: str(r.BSNS_MBY_NM) || "청약홈",
        region,
        summary: [str(r.HSSPLY_ADRES), type, units && `${units}세대`, start && `접수 ${start}~`].filter(Boolean).join(" · "),
        conditions: buildConditions("housing", region, "", kind === "remndr" ? [] : [HOMELESS_HINT]),
        applyEnd: end,
        apply: { how: "청약홈에서 온라인 청약", where: str(r.BSNS_MBY_NM) || undefined, url },
        place: str(r.HSSPLY_ADRES) || undefined,
        url,
        source: "applyhome",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
    });
}

export const applyhome: SourceAdapter = {
  id: "applyhome",
  domains: ["housing"],
  envKey: "DATA_GO_KR_KEY",
  async fetch(now) {
    const key = encodeURIComponent(process.env.DATA_GO_KR_KEY!);
    const today = todayKst(now);
    const out: Opportunity[] = [];
    // 세 종류 중 일부만 실패해도 나머지는 쓴다(활용신청 안 했으면 모두 실패 → 상위에서 빈 배열 처리)
    const results = await Promise.allSettled(
      (Object.keys(OPS) as Kind[]).map(async (kind) => {
        const { op, endKey } = OPS[kind];
        const cond = `${encodeURIComponent(`cond[${endKey}::GTE]`)}=${today}`;
        return mapApplyhome(await fetchJson(`${BASE}/${op}?page=1&perPage=50&serviceKey=${key}&${cond}`), kind, now);
      }),
    );
    for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
    if (out.length === 0) {
      const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (err) throw err.reason;
    }
    return out;
  },
};
