import type { Match } from "@/lib/types";
import { daysLeft, ddayLabel } from "@/lib/alerts/core";
import { DOMAIN_META } from "./domain";
import { opportunityDistance, type UserLocation } from "@/lib/geo/distance";
import { Icon } from "@/components/brand/Icons";

function ddayClass(applyEnd?: string): string {
  const d = daysLeft(applyEnd);
  if (d === null) return "bg-slate-100 text-slate-600";
  if (d < 0) return "bg-slate-200 text-slate-500";
  if (d <= 3) return "bg-rose-100 text-rose-700";
  return "bg-indigo-50 text-indigo-700";
}

/** aiExplanation: lib/ai의 explainMatch 결과(있으면 "AI 생성" 표시) */
export function MatchCard({
  match,
  location,
  highlighted,
  onShowMap,
  aiSummary,
  summaryMs,
}: {
  match: Match;
  location?: UserLocation;
  highlighted?: boolean;
  onShowMap?: () => void;
  aiSummary?: { summary: string; how: string };
  summaryMs?: number;
}) {
  const o = match.opportunity;
  const meta = DOMAIN_META[o.domain];
  const distance = location ? opportunityDistance(location, o) : null;
  return (
    <article
      id={`match-${encodeURIComponent(o.id)}`}
      data-domain={o.domain}
      data-highlighted={highlighted ? "true" : undefined}
      data-summary-ms={summaryMs === undefined ? undefined : Math.round(summaryMs)}
      style={{ borderLeftColor: meta.color }}
      className={`app-card space-y-4 border-l-4 p-4 text-slate-900 ${highlighted ? "ring-2 ring-indigo-500" : ""}`}
    >
      <header className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
          style={{ backgroundColor: meta.color }}
          aria-hidden
        >
          <Icon name={meta.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-slate-500">{meta.label}</span>
            {o.isSample && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">샘플 데이터</span>}
            {o.origin === "rss" && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-800">SH 공식 RSS · 원문 확인</span>}
            {o.origin === "websearch" && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">웹 검색 결과 · 원문 확인 필요</span>
            )}
            {match.status === "needs_check" && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-800">확인 필요</span>
            )}
          </div>
          <h2 className="text-base font-bold leading-snug">{o.title}</h2>
          <p className="text-xs text-slate-500">{o.org}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${ddayClass(o.applyEnd)}`}>
          {ddayLabel(o.applyEnd)}
        </span>
      </header>

      {(aiSummary?.summary || o.summary) && (
        <section className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          <h3 className="flex items-center gap-1 font-semibold text-slate-800"><Icon name="exam" className="h-4 w-4" />요약</h3>
          <p>
            {aiSummary && <span className="mr-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">AI 요약</span>}
            {aiSummary?.summary ?? o.summary}
          </p>
        </section>
      )}
      {o.place && <p className="flex items-center gap-1 text-sm text-slate-700"><Icon name="pin" className="h-4 w-4" />{o.place}</p>}
      <section className="text-sm text-slate-700">
        <h3 className="font-semibold text-slate-800">신청 방법</h3>
        <p>{aiSummary?.how ?? o.apply?.how ?? "공고 상세 페이지에서 신청 방법 확인"}</p>
        {o.apply?.where && <p className="text-xs text-slate-500">접수: {o.apply.where}</p>}
      </section>
      {distance !== null && <p className="text-sm font-semibold text-indigo-700">내 위치에서 {distance.toFixed(1)}km</p>}
      {location && (!o.geo || o.geo.precision === "region") && (
        <p className="text-xs text-slate-500">위치가 지역 단위라 거리 판단 불가</p>
      )}
      {onShowMap && o.geo?.precision !== "region" && (
        <button type="button" onClick={onShowMap} className="min-h-11 w-full rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700">
          지도에서 보기
        </button>
      )}

      {match.unknowns.length > 0 && (
        <section className="rounded-xl bg-orange-50 p-3 text-sm">
          <h3 className="mb-1 font-semibold text-orange-800">확인 필요</h3>
          <ul className="space-y-1.5 text-orange-900">
            {match.unknowns.map((c, i) => (
              <li key={i}>
                {c.aiGenerated && <span className="mr-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">AI 해석</span>}
                <q className="text-xs italic">{c.rawText}</q>
                {c.confidence === "low" && <span className="ml-1 text-[10px] text-orange-600">(자동 해석 불확실)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <a
        href={o.apply?.url || o.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block min-h-11 content-center rounded-xl bg-indigo-600 px-4 py-2 text-center text-sm font-bold text-white"
      >
        신청 페이지 열기 ↗
      </a>
    </article>
  );
}
