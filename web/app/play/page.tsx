"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AnswerButtons from "@/components/game/AnswerButtons";
import RemainingGauge from "@/components/game/RemainingGauge";
import styles from "@/components/game/game.module.css";
import { applyAnswer, getMatches, nextQuestion, remaining, startGame, type GameState } from "@/lib/engine";
import { FIXTURE_OPPORTUNITIES } from "@/lib/engine/__fixtures__/opportunities";
import type { Answer, Opportunity } from "@/lib/types";

const MAX_QUESTIONS = 6; // 가벼운 사용감: 6문항 안쪽(UX 레퍼런스), 2문항부터 바로 결과 보기
const DONE_AT = 5;

async function loadPool(): Promise<{ pool: Opportunity[]; fallback: boolean }> {
  try {
    const res = await fetch("/api/opportunities");
    if (res.ok) {
      const data = (await res.json()) as Opportunity[];
      if (Array.isArray(data) && data.length > 0) return { pool: data, fallback: false };
    }
  } catch {
    // API 없음 → 픽스처
  }
  return { pool: FIXTURE_OPPORTUNITIES, fallback: true };
}

export default function PlayPage() {
  const router = useRouter();
  const [history, setHistory] = useState<GameState[] | null>(null);
  const [fallback, setFallback] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [stopNow, setStopNow] = useState(false);
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const aiOff = useRef(false);

  useEffect(() => {
    loadPool().then(({ pool, fallback }) => {
      setFallback(fallback);
      setHistory([startGame(pool)]);
    });
  }, []);

  const state = history?.at(-1) ?? null;
  const view = useMemo(() => {
    if (!state) return null;
    const left = remaining(state);
    const asked = state.answers.length;
    const q = nextQuestion(state);
    const done = stopNow || !q || asked >= MAX_QUESTIONS || (asked > 0 && left <= DONE_AT);
    // 예·아니오 각각을 골랐을 때 남는 후보 수(질문이 얼마나 갈라 주는지 보여 줌)
    const split = q ? { yes: remaining(applyAnswer(state, q, "yes")), no: remaining(applyAnswer(state, q, "no")) } : null;
    return { left, asked, q, done, split };
  }, [state, stopNow]);

  useEffect(() => {
    if (!state || !view?.done) return;
    setFinishing(true);
    const result = { answers: state.answers, matches: getMatches(state), pool: state.pool };
    try {
      sessionStorage.setItem("lastResult", JSON.stringify(result));
    } catch {
      // 저장 실패해도 결과 화면으로 이동
    }
    const t = setTimeout(() => router.push("/result"), 900);
    return () => clearTimeout(t);
  }, [state, view?.done, router]);

  // ANTHROPIC_API_KEY가 있으면 서버에서 질문 문장을 다듬는다. 없으면 기본 문장 그대로.
  const q = view?.done ? null : (view?.q ?? null);
  useEffect(() => {
    if (!q || aiOff.current || aiText[q.id]) return;
    let alive = true;
    fetch("/play/phrase", { method: "POST", body: JSON.stringify({ attr: q.attr, op: q.op, value: q.value }) })
      .then((r) => r.json())
      .then((d: { ai: boolean; text?: string }) => {
        if (!d.ai) aiOff.current = true;
        else if (alive && d.text) setAiText((m) => ({ ...m, [q.id]: d.text! }));
      })
      .catch(() => (aiOff.current = true));
    return () => {
      alive = false;
    };
  }, [q, aiText]);
  const shownText = q ? (aiText[q.id] ?? q.text) : "";

  const answer = (a: Answer) => {
    if (!state || !q) return;
    setHistory([...(history ?? []), applyAnswer(state, { ...q, text: shownText }, a)]);
  };
  const undo = () => history && history.length > 1 && setHistory(history.slice(0, -1));

  if (!state || !view) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-500">
        <span className={styles.orb}>🔮</span>&nbsp;공고를 모으는 중…
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 py-6 text-slate-900">
      <header className="flex items-center justify-between text-sm">
        <Link href="/" className="text-slate-500">
          ← 처음으로
        </Link>
        {fallback && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">임시 샘플 데이터</span>}
      </header>

      <RemainingGauge remaining={view.left} total={state.pool.length} />

      {view.done ? (
        <section className={`${styles.cardIn} flex flex-1 flex-col items-center justify-center gap-3 text-center`}>
          <p className="text-5xl">
            <span className={styles.orb}>🔮</span>
          </p>
          <p className="text-xl font-bold">
            {view.left > 0 ? `${view.left}개로 좁혔어요!` : "딱 맞는 공고를 못 찾았어요"}
          </p>
          <p className="text-slate-500">결과를 정리하는 중…</p>
        </section>
      ) : (
        view.q && (
          <section key={view.q.id} className={`${styles.cardIn} flex flex-1 flex-col justify-center gap-8`}>
            <div className="space-y-3 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-sm">
              <p className="text-sm font-medium text-indigo-500">
                질문 {view.asked + 1} / 약 {MAX_QUESTIONS}
              </p>
              <p className="text-2xl font-bold leading-snug break-keep">{shownText}</p>
              {aiText[view.q.id] && <p className="text-xs text-slate-400">AI 생성 문장</p>}
              {view.split && (
                <p className="text-xs text-slate-500">
                  예면 {view.split.yes}개, 아니오면 {view.split.no}개 남아요
                </p>
              )}
            </div>
            <AnswerButtons onAnswer={answer} disabled={finishing} />
            {view.asked >= 2 && (
              <button
                type="button"
                onClick={() => setStopNow(true)}
                className="text-sm font-medium text-indigo-600 underline underline-offset-4"
              >
                여기까지만 답하고 바로 결과 보기 ({view.left}개)
              </button>
            )}
          </section>
        )
      )}

      <footer className="flex flex-col items-center gap-2 text-center text-xs text-slate-400">
        <button type="button" onClick={undo} disabled={history!.length <= 1 || finishing} className="text-sm text-slate-500 disabled:invisible">
          ↶ 이전 질문
        </button>
        <span className="break-keep">모르면 &lsquo;모르겠어요&rsquo;를 누르세요. 결과에서 확인할 점으로 알려 드려요.</span>
      </footer>
    </main>
  );
}
