"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Domain } from "@/lib/types";

const DOMAINS: { id: Domain; emoji: string; label: string }[] = [
  { id: "housing", emoji: "🏠", label: "청년 주택" },
  { id: "benefit", emoji: "💰", label: "지원금·혜택" },
  { id: "job", emoji: "💼", label: "채용·인턴" },
  { id: "parttime", emoji: "⏰", label: "알바·단기직" },
  { id: "training", emoji: "📚", label: "국비 과정" },
  { id: "exam", emoji: "📝", label: "자격증 일정" },
];

export default function Home() {
  const router = useRouter();
  const [picked, setPicked] = useState<Domain[]>([]);
  // 분야별 지금 조회되는 공고 수(0건 분야는 고르기 전에 알려 준다). 서버 캐시도 미리 데운다.
  const [counts, setCounts] = useState<Partial<Record<Domain, number>> | null>(null);
  useEffect(() => {
    fetch("/api/opportunities")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { domain: Domain }[]) => {
        if (!Array.isArray(list) || list.length === 0) return; // 일시 오류로 빈 응답이면 막지 않는다
        const c: Partial<Record<Domain, number>> = {};
        for (const o of list) c[o.domain] = (c[o.domain] ?? 0) + 1;
        setCounts(c);
      })
      .catch(() => {});
  }, []);
  const toggle = (d: Domain) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const start = () => router.push(picked.length ? `/play?domains=${picked.join(",")}` : "/play");

  return (
    <main className="flex flex-1 flex-col justify-center gap-7 py-10">
      <div className="space-y-3 text-center">
        <p className="text-5xl" aria-hidden>
          🔮
        </p>
        <h1 className="text-3xl font-bold">찾아줄게</h1>
        <p className="text-lg font-semibold leading-snug text-slate-700 break-keep">
          질문 몇 개로 조건을 저장하면,
          <br />
          연결된 출처를 매일 다시 조회해서
          <br />
          처음 보는 공고만 알려 줄게요.
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-center text-sm font-semibold text-slate-600">무엇을 찾고 있나요? (여러 개 선택)</p>
        <ul className="grid grid-cols-3 gap-2 text-center text-sm">
          {DOMAINS.map((d) => {
            const on = picked.includes(d.id);
            const n = counts ? (counts[d.id] ?? 0) : null;
            const empty = n === 0;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={empty}
                  onClick={() => toggle(d.id)}
                  className={`w-full rounded-xl p-3 shadow-sm transition ${
                    on ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : "bg-white text-slate-800"
                  } disabled:opacity-40`}
                >
                  <span className="block text-2xl" aria-hidden>
                    {d.emoji}
                  </span>
                  {d.label}
                  {n !== null && <span className={`block text-[11px] ${on ? "text-indigo-100" : "text-slate-400"}`}>{empty ? "연결 준비 중" : `${n}건`}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-xs text-slate-400">고르지 않으면 전체에서 찾아요</p>
      </section>

      <div className="space-y-3">
        <button
          type="button"
          onClick={start}
          className="block w-full rounded-2xl bg-indigo-600 py-4 text-center text-lg font-semibold text-white shadow active:scale-95"
        >
          {picked.length ? `${picked.length}개 분야로 시작하기` : "30초 만에 시작하기"}
        </button>
        <Link href="/alerts" className="block py-3 text-center text-sm text-slate-500 underline">
          이미 조건이 있어요 → 알림함
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400">
        연결 출처: LH·마이홈·청약홈·잡알리오·정부24·Q-Net. 실제 조회된 공고만 제공하며, 분야에 따라 결과가 없을 수 있습니다.
        <br />
        결과는 참고용이며 최종 자격은 원문에서 확인하세요. 알림을 켜면 예·아니오 답변만 서버에 저장돼요.
      </p>
    </main>
  );
}
