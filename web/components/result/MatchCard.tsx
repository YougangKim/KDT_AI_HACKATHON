import type { Match } from "@/lib/types";
import { daysLeft, ddayLabel } from "@/lib/alerts/core";
import { DOMAIN_META } from "./domain";
import { AI_TAG } from "@/lib/engine";

/** 같은 조건 문장이 질문 근거와 함께 두 번 나오는 것을 하나로 합치고, 최대 3줄만 보여 준다 */
function tidyReasons(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) {
    const base = r.replace(/ \(“.*$/, "");
    const i = out.findIndex((x) => x.replace(/ \(“.*$/, "") === base);
    if (i >= 0) {
      if (r.length > out[i].length) out[i] = r;
    } else out.push(r);
  }
  // 분야(내가 고른 분야라 당연함)보다 지역·나이·무주택 같은 자격 근거를 먼저 보여 준다
  const isDomain = (r: string) => /^(분야|관심 분야):/.test(r.replace(/^\[AI 해석\] /, ""));
  return [...out.filter((r) => !isDomain(r)), ...out.filter(isDomain)].slice(0, 3);
}

function ddayClass(applyEnd?: string): string {
  const d = daysLeft(applyEnd);
  if (d === null) return "bg-slate-100 text-slate-600";
  if (d < 0) return "bg-slate-200 text-slate-500";
  if (d <= 3) return "bg-rose-100 text-rose-700";
  return "bg-indigo-50 text-indigo-700";
}

/** aiExplanation: lib/ai의 explainMatch 결과(있으면 "AI 생성" 표시) */
export function MatchCard({ match, aiExplanation }: { match: Match; aiExplanation?: string }) {
  const o = match.opportunity;
  const meta = DOMAIN_META[o.domain];
  return (
    <article className="space-y-3 rounded-2xl bg-white p-4 text-slate-900 shadow-sm">
      <header className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          {meta.emoji}
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
          <h2 className="font-semibold leading-snug">{o.title}</h2>
          <p className="text-xs text-slate-500">{o.org}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${ddayClass(o.applyEnd)}`}>
          {ddayLabel(o.applyEnd)}
        </span>
      </header>

      {o.summary && <p className="text-sm text-slate-700">{o.summary}</p>}

      {(match.reasons.length > 0 || aiExplanation) && (
        <section className="rounded-xl bg-emerald-50 p-3 text-sm">
          <h3 className="mb-1 font-semibold text-emerald-800">왜 맞는지</h3>
          {aiExplanation && (
            <p className="mb-1 text-emerald-900">
              <span className="mr-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">AI 생성</span>
              {aiExplanation}
            </p>
          )}
          <ul className="list-disc space-y-0.5 pl-5 text-emerald-900">
            {tidyReasons(match.reasons).map((r, i) => (
              <li key={i}>
                {r.startsWith(AI_TAG) && <span className="mr-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">AI 해석</span>}
                {r.startsWith(AI_TAG) ? r.slice(AI_TAG.length) : r}
              </li>
            ))}
          </ul>
        </section>
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
        href={o.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl border border-slate-200 py-2 text-center text-sm font-medium text-indigo-700"
      >
        공고 원문 보기 ↗
      </a>
    </article>
  );
}
