// 공고 유형 판별(분야 + 제목 키워드), 제목 정리, 대상 판정.
import type { Opportunity } from "@/lib/types";
import type { Profile } from "./profile";
import { regionAliases } from "@/lib/geo/regions";

export type PrepKind = "job" | "job_event" | "parttime" | "benefit_cash" | "benefit_service" | "housing_rent" | "housing_sale" | "training" | "exam";

export const KIND_LABEL: Record<PrepKind, string> = {
  job: "채용", job_event: "채용 행사", parttime: "알바", benefit_cash: "지원금", benefit_service: "지원 서비스",
  housing_rent: "임대 주거", housing_sale: "분양", training: "국비 과정", exam: "자격증 시험",
};

const EVENT = /박람회|채용\s?행사|공동\s?행사|면접회|면접\s?공동|만남의\s?날|매칭\s?데이|채용\s?설명회|잡\s?페어|일자리\s?(페스티벌|축제)|수요데이/;

export function prepKind(o: Pick<Opportunity, "domain" | "title" | "org" | "source">): PrepKind {
  const t = `${o.title} ${o.org}`;
  switch (o.domain) {
    case "job": return EVENT.test(t) || o.source === "work24-event" ? "job_event" : "job";
    case "parttime": return EVENT.test(t) ? "job_event" : "parttime";
    case "benefit": return /수당|지원금|장려금|바우처|급여|이자|대출|월세|적금|저축|금융/.test(o.title) ? "benefit_cash" : "benefit_service";
    case "housing": return /분양|청약(?!.*임대)/.test(o.title) && !/임대/.test(o.title) ? "housing_sale" : "housing_rent";
    case "training": return "training";
    case "exam": return "exam";
  }
}

/** "77_(일자리 수요데이) 중장년 …" → 표시 제목 + 부제 */
export function cleanTitle(title: string): { title: string; series?: string; num?: string } {
  let t = title.trim();
  const num = t.match(/^(\d{1,3})[_.]\s*/)?.[1];
  if (num) t = t.slice(t.indexOf(num) + num.length).replace(/^[_.\s]+/, "");
  const series = t.match(/^[(\[]([^)\]]{2,20})[)\]]\s*/);
  if (series) t = t.slice(series[0].length);
  return { title: t || title, series: series?.[1], num };
}

/** 초안에 쓸 짧은 이름. 28자 넘으면 회사명 + 행사 종류 */
export function shortTitle(title: string, kind: PrepKind): string {
  const t = cleanTitle(title).title;
  if (t.length <= 28) return t;
  const co = companyIn(t);
  const ev = ["면접 공동행사", "채용박람회", "박람회", "채용설명회", "공동행사", "만남의 날"].find((k) => t.includes(k));
  if (co && kind === "job_event") return `${co} ${ev ?? "채용 행사"}`;
  return `${t.slice(0, 38)}…`;
}

/** 제목 안 회사명 "(주)면사랑" */
export function companyIn(text: string): string | undefined {
  return text.match(/(\((주|유|재)\)\s?[가-힣A-Za-z0-9&]+|[가-힣A-Za-z0-9&]+\s?\((주|유)\)|주식회사\s?[가-힣A-Za-z0-9&]+)/)?.[0]?.replace(/\s+/g, "");
}

/** 기관명이 출처 이름이면 초안 주어로 쓰지 않는다 */
export function isSourceName(org: string): boolean {
  return /고용24|워크넷|온통청년|공공데이터|채용행사|정부24|복지로|잡코리아|사람인|웹 검색|RSS/.test(org);
}

/** 받침에 따라 "이/가" */
export function iga(w: string): string {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${w}이(가)`;
  return (c - 0xac00) % 28 ? `${w}이` : `${w}가`;
}

/** ok 신청 가능 · check 확인할 조건 있음 · warn 대상 다를 수 있음(초안 보류) · block 대상 아님·마감 지남 */
export type TargetLevel = "ok" | "check" | "warn" | "block";
export interface TargetCheck { level: TargetLevel; head: string; why: string; titleAge?: string; expired?: boolean }

const OLDER = /(중장년|신중년|장년|고령자|노인|어르신|시니어|5060|4050|50\+|50플러스)/;
const SPECIAL = /(경력단절|경단녀|북한이탈|장애인\s?전용|보훈|외국인|다문화|한부모)/;
const josa = (w: string) => iga(w).slice(w.length);

export function targetCheck(
  o: Pick<Opportunity, "title" | "conditions" | "summary" | "region" | "applyEnd">,
  p: Profile,
  needsCheck: boolean,
  now = new Date(),
): TargetCheck {
  const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10); // KST 날짜
  if (o.applyEnd && o.applyEnd.slice(0, 10) < today) {
    return { level: "block", expired: true, head: "마감이 지난 공고입니다", why: `마감일은 ${o.applyEnd.slice(0, 10)}입니다. 연장·추가 모집이 있는지 원문에서 확인하세요.` };
  }
  const ageHi = p.age?.[1] ?? null;
  const mine = p.age ? (p.age[0] !== null && p.age[1] !== null ? `만 ${p.age[0]}~${p.age[1]}세` : ageHi !== null ? `만 ${ageHi}세 이하` : `만 ${p.age[0]}세 이상`) : null;
  for (const c of o.conditions) {
    if (c.attr === "age" && c.op === "gte" && ageHi !== null && ageHi < Number(c.value)) {
      return { level: "block", head: "이 공고는 대상이 아닐 가능성이 높습니다", why: `공고 조건은 '${c.rawText}'인데 내 답은 ${mine}입니다. 원문의 참여 대상을 확인하세요.` };
    }
  }
  const mineRegions = p.region ? [p.region, ...regionAliases(p.region)] : [];
  if (p.region && o.region.length && !o.region.some((r) => [r, ...regionAliases(r)].some((x) => mineRegions.includes(x)))) {
    return { level: "block", head: "다른 지역 대상 공고입니다", why: `공고 지역은 ${o.region.join("·")}인데 내 답은 ${p.region} 거주입니다. 원문에서 거주 조건을 확인하세요.` };
  }
  const titleOlder = o.title.match(OLDER)?.[1];
  const sumOlder = titleOlder ? undefined : o.summary.match(OLDER)?.[1];
  const older = titleOlder ?? sumOlder;
  if (older && !/청년/.test(o.title)) {
    const where = titleOlder ? "제목" : "공고 요약";
    return {
      level: "warn", head: "대상이 아닐 수 있습니다", titleAge: older,
      why: `${where}에 '${older}'${josa(older)} 있어 보통 만 40세 이상(또는 50세 이상) 대상입니다.${mine && (ageHi ?? 99) <= 39 ? ` 내 답은 ${mine}입니다.` : ""} 원문의 '참여 대상'을 먼저 확인하세요.`,
    };
  }
  const special = (o.title.match(SPECIAL) ?? o.summary.match(SPECIAL))?.[1];
  if (special) return { level: "warn", head: "특정 대상 전용 공고로 보입니다", why: `공고에 '${special}'${josa(special)} 있습니다. 원문에서 참여 대상을 먼저 확인하세요.` };
  if (needsCheck) return { level: "check", head: "확인할 조건이 남아 있습니다", why: "아래 '확인' 표시된 조건을 원문에서 확인한 뒤 신청하세요." };
  return { level: "ok", head: "답한 조건 기준으로 신청할 수 있습니다", why: "제출 전 원문에서 자격과 서류를 한 번 더 확인하세요." };
}
