import type { Domain, Match } from "@/lib/types";
import type { LastResult } from "./lastResult";
import { getMatches } from "@/lib/engine";
import { opportunityDistance } from "@/lib/geo/distance";
import { DOMAIN_META } from "./domain";

/** 순위에 원문 근거가 없는 인기도·금액·게시일은 만들어 내지 않는다. */
export function OpportunityInsights({ result, domain }: { result: LastResult; domain: Domain | "all" }) {
  const matches = result.matches.filter((m) => domain === "all" || m.opportunity.domain === domain);
  const located = result.location ? matches.map((m) => ({ m, km: opportunityDistance(result.location!, m.opportunity) })).filter((v): v is { m: Match; km: number } => v.km !== null).sort((a, b) => a.km - b.km) : [];
  const recent = matches.filter((m) => m.opportunity.applyStart && Number.isFinite(Date.parse(m.opportunity.applyStart))).sort((a, b) => Date.parse(b.opportunity.applyStart!) - Date.parse(a.opportunity.applyStart!))[0];
  const deadline = matches.filter((m) => m.opportunity.applyEnd && Date.parse(m.opportunity.applyEnd) >= Date.now()).sort((a, b) => Date.parse(a.opportunity.applyEnd!) - Date.parse(b.opportunity.applyEnd!))[0];
  const selected = new Set(result.answers.filter((a) => a.question.attr === "interest" && a.answer === "yes").map((a) => String(a.question.value)));
  const related = selected.size ? getMatches({ pool: result.pool ?? [], answers: result.answers.filter((a) => a.question.attr !== "interest") }).filter((m) => !selected.has(m.opportunity.domain)).filter((m, i, all) => all.findIndex((v) => v.opportunity.domain === m.opportunity.domain) === i).slice(0, 3) : [];
  const item = (match: Match, label: string) => (
    <a href={match.opportunity.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-slate-200 p-3">
      <span className="text-xs font-semibold text-indigo-700">{label}</span>
      <p className="font-semibold">{match.opportunity.title}</p>
      <p className="text-xs text-slate-600">{DOMAIN_META[match.opportunity.domain].label} · {match.status === "eligible" ? "입력 조건 일치" : "자격 확인 필요"} · 원문 ↗</p>
    </a>
  );
  return <section aria-label="맞춤 기회 분석" className="app-card space-y-3 p-4">
    <h2 className="font-bold">활용할 수 있는 기회</h2>
    <p className="text-sm">{matches.length}건 중 입력 조건 일치 {matches.filter((m) => m.status === "eligible").length}건 · 자격 확인 필요 {matches.filter((m) => m.status !== "eligible").length}건</p>
    {!matches.length && <p className="text-sm text-slate-600">현재 조건과 반경에 맞는 공고가 없습니다. 조건 수정에서 답변을 조정할 수 있습니다.</p>}
    {located[0] && item(located[0].m, `가까운 기회 · 직선거리 ${located[0].km.toFixed(1)}km`)}
    {recent && item(recent, `최근 접수 시작 · ${recent.opportunity.applyStart}`)}
    {deadline && item(deadline, `마감 우선 확인 · ${deadline.opportunity.applyEnd}`)}
    {related.length > 0 && <><h3 className="font-semibold">함께 살펴볼 다른 분야</h3><p className="text-xs text-slate-600">관심 분야 제한만 풀어 찾은 후보입니다. 자격과 방문 거리는 원문 확인이 필요합니다.</p>{related.map((m) => <div key={m.opportunity.id}>{item(m, "다른 분야 제안")}</div>)}</>}
    <p className="text-xs text-slate-500">조회·신청 수와 비교 가능한 지급액이 없어 인기·혜택 순위는 산정하지 않습니다.</p>
  </section>;
}
