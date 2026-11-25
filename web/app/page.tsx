"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Domain } from "@/lib/types";
import { Logo } from "@/components/brand/Logo";
import { Splash } from "@/components/brand/Splash";
import { Icon, type IconName } from "@/components/brand/Icons";

const DOMAINS: { id: Domain; icon: IconName; label: string; color: string }[] = [
  { id: "housing", icon: "housing", label: "청년 주택", color: "#15803d" },
  { id: "benefit", icon: "benefit", label: "지원금·혜택", color: "#7e22ce" },
  { id: "job", icon: "job", label: "채용·인턴", color: "#1d4ed8" },
  { id: "parttime", icon: "parttime", label: "알바·단기직", color: "#c2410c" },
  { id: "training", icon: "training", label: "국비 과정", color: "#0f766e" },
  { id: "exam", icon: "exam", label: "자격증 일정", color: "#475569" },
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
  // 인터뷰를 마친 적이 있으면 그 결과 화면으로 바로 돌아가는 버튼을 보여 준다
  const [hasResult, setHasResult] = useState(false);
  useEffect(() => {
    try { setHasResult(!!localStorage.getItem("lastResult")); } catch {}
  }, []);
  const toggle = (d: Domain) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const start = () => router.push(picked.length ? `/play?domains=${picked.join(",")}` : "/play");

  return (
    <main className="flex flex-1 flex-col justify-center gap-7 py-10">
      <Splash />
      <div className="space-y-4 text-center">
        <h1>
          <Logo className="justify-center" symbolClassName="h-11 w-11" />
        </h1>
        <p className="text-lg font-semibold leading-relaxed text-slate-700 break-keep">
          질문 몇 개로 조건을 저장하면,
          <br />
          연결된 출처를 매일 다시 조회해서
          <br />
          새로 확인된 공고만 알립니다.
        </p>
      </div>

      <section className="app-card space-y-3 p-4">
        <p className="text-center text-sm font-semibold text-slate-600">무엇을 찾고 있습니까? (여러 개 선택)</p>
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
                  className={`min-h-24 w-full rounded-xl p-3 font-semibold shadow-sm ${
                    on ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : "bg-slate-50 text-slate-800 ring-1 ring-slate-200"
                  } disabled:opacity-40`}
                >
                  <span
                    className="mx-auto mb-1 grid h-9 w-9 place-items-center rounded-xl text-white"
                    style={{ backgroundColor: on ? "rgb(255 255 255 / 18%)" : d.color }}
                    aria-hidden
                  >
                    <Icon name={d.icon} className="h-5 w-5" />
                  </span>
                  {d.label}
                  {n !== null && <span className={`block text-[11px] ${on ? "text-indigo-100" : "text-slate-400"}`}>{empty ? "연결 준비 중" : `${n}건`}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-xs text-slate-400">선택하지 않으면 전체 분야에서 검색합니다.</p>
      </section>

      <div className="space-y-3">
        {hasResult && (
          <Link href="/result" className="block min-h-14 w-full rounded-2xl border-2 border-indigo-600 bg-white py-4 text-center text-lg font-bold text-indigo-700 active:scale-[0.98]">
            지난 인터뷰 결과 보기
          </Link>
        )}
        <button
          type="button"
          onClick={start}
          className="block min-h-14 w-full rounded-2xl bg-indigo-600 py-4 text-center text-lg font-bold text-white shadow-lg shadow-indigo-200 active:scale-[0.98]"
        >
          {picked.length ? `${picked.length}개 분야로 ${hasResult ? "다시하기" : "시작하기"}` : hasResult ? "다시하기" : "질문 몇 개로 시작하기"}
        </button>
        <Link href="/alerts" className="block py-3 text-center text-sm text-slate-500 underline">
          저장한 조건 → 알림함
        </Link>
        <Link href="/settings" className="block text-center text-sm text-slate-500 underline">
          <Icon name="settings" className="mr-1 inline h-4 w-4 align-[-2px]" />알림 설정
        </Link>
      </div>

      <p className="text-center text-[13px] leading-5 text-slate-600 break-keep">
        LH·마이홈·청약홈·잡알리오·정부24·Q-Net 등 연결 출처에서 실제 조회된 공고만 제공하며, 분야에 따라 결과가 없을 수 있습니다.
        <br />
        최종 자격은 원문에서 확인하고, 알림을 켜면 예·아니오 답변만 서버에 저장됩니다.
      </p>
    </main>
  );
}
