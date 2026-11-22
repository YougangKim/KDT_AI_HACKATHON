// 사람인 채용정보 API (oapi.saramin.co.kr, 승인 심사 필요). 기본 OFF: SARAMIN_ENABLED=1 + SARAMIN_KEY 일 때만.
// 약관상 출처 표기 필요 → org 옆에 "사람인 제공"을 붙이고 원문 링크로 보낸다. 신입·경력무관 공고만 가져온다.
import type { Opportunity } from "../types";
import type { SourceAdapter } from "./types";
import { buildConditions, fetchJson, str, toRegions } from "./util";

const ENDPOINT = "https://oapi.saramin.co.kr/job-search";

const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined), o);

const kstDate = (unixSec: unknown) => {
  const n = Number(unixSec);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000 + 9 * 3600_000).toISOString().slice(0, 10) : undefined;
};

export function mapSaramin(raw: unknown, now: Date): Opportunity[] {
  const list = get(raw, "jobs", "job");
  const items = Array.isArray(list) ? list : list ? [list] : [];
  return items
    .filter((j) => str(get(j, "position", "title")) && str(get(j, "active")) !== "0")
    .map((j) => {
      const title = str(get(j, "position", "title"));
      const company = str(get(j, "company", "detail", "name"));
      const loc = str(get(j, "position", "location", "name")).replace(/&gt;/g, ">");
      const region = toRegions(...loc.split(",").map((s) => s.split(">")[0].trim()));
      const exp = str(get(j, "position", "experience-level", "name"));
      const type = str(get(j, "position", "job-type", "name"));
      const edu = str(get(j, "position", "required-education-level", "name"));
      return {
        id: `saramin:${str(get(j, "id"))}`,
        domain: "job" as const,
        title,
        org: `${company || "기업"} · 사람인 제공`,
        region,
        summary: [loc, exp, type, edu].filter(Boolean).join(" · "),
        conditions: buildConditions("job", region, ""),
        applyEnd: kstDate(get(j, "expiration-timestamp")),
        url: str(get(j, "url")) || "https://www.saramin.co.kr/",
        source: "saramin",
        isSample: false,
        fetchedAt: now.toISOString(),
      };
    });
}

export const saramin: SourceAdapter = {
  id: "saramin",
  domains: ["job"],
  envKey: "SARAMIN_KEY",
  async fetch(now) {
    if (process.env.SARAMIN_ENABLED !== "1") return [];
    const key = encodeURIComponent(process.env.SARAMIN_KEY!);
    // exp_cd=1 신입(경력무관 포함은 exp_none), 진행 중 공고만, 마감 임박순
    const url = `${ENDPOINT}?access-key=${key}&exp_cd=1&count=50&sort=ud`;
    return mapSaramin(await fetchJson(url), now);
  },
};
