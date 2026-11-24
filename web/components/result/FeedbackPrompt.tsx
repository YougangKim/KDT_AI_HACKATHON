"use client";

// 알림 설정 성공 직후: 승인 메시지 → 설문 하단 시트 → 완료. 시안 docs/설계/피드백_설문_시안.html
import { useEffect, useState } from "react";
import { FEEDBACK_STATE, REUSE, SCREENS, shouldAsk, type FeedbackState } from "@/lib/feedback";
import s from "./feedback.module.css";

function readState(): FeedbackState | null {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STATE) ?? "null");
  } catch {
    return null;
  }
}
function writeState(v: FeedbackState) {
  try {
    localStorage.setItem(FEEDBACK_STATE, JSON.stringify(v));
  } catch {}
}

function Scale({ value, set, lo, hi, label }: { value: number; set: (n: number) => void; lo: string; hi: string; label: string }) {
  return (
    <>
      <div className={s.scale} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={value === n} className={value === n ? s.on : ""} onClick={() => set(n)}>{n}</button>
        ))}
      </div>
      <div className={s.ends}><span>{lo}</span><span>{hi}</span></div>
    </>
  );
}

export function FeedbackPrompt({ trigger }: { trigger: number }) {
  const [step, setStep] = useState<"none" | "ask" | "form" | "done">("none");
  const [ease, setEase] = useState(0);
  const [fit, setFit] = useState(0);
  const [screen, setScreen] = useState("");
  const [reuse, setReuse] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!trigger || !shouldAsk(readState())) return;
    const t = setTimeout(() => setStep("ask"), 800);
    return () => clearTimeout(t);
  }, [trigger]);

  useEffect(() => {
    if (step === "none") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && later();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function later() {
    if (step !== "done") writeState({ snoozedAt: Date.now() });
    setStep("none");
  }

  async function submit() {
    setSending(true);
    setError("");
    const ref = new URLSearchParams(location.search).get("ref") ?? undefined;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ease, fit, screen: screen || undefined, reuse, comment, path: location.pathname, ref }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "전송 실패");
      writeState({ done: true });
      setStep("done");
    } catch (e) {
      setError(`${(e as Error).message}. 다시 눌러 주세요.`);
    } finally {
      setSending(false);
    }
  }

  if (step === "none") return null;
  const answered = [ease, fit, reuse].filter(Boolean).length;
  const ready = answered === 3;

  if (step === "done")
    return (
      <div className={s.dim}>
        <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="fb-done">
          <div className={`${s.badge} ${s.badgeDone}`} aria-hidden>🙏</div>
          <h2 id="fb-done" className={s.title}>소중한 의견 감사합니다</h2>
          <p className={s.text}>보내 주신 의견은 공고 추천과<br />질문 개선에 반영할게요.</p>
          <button className={s.primary} onClick={() => setStep("none")} autoFocus>결과로 돌아가기</button>
        </div>
      </div>
    );

  if (step === "ask")
    return (
      <div className={s.dim} onClick={later}>
        <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="fb-ask" onClick={(e) => e.stopPropagation()}>
          <div className={s.badge} aria-hidden>💬</div>
          <h2 id="fb-ask" className={s.title}>알림 설정이 끝났어요</h2>
          <p className={s.text}>My News를 써 보신 느낌을 알려 주시면<br />더 정확한 공고 찾기에 반영할게요.</p>
          <p className={s.meta}>5문항 · 약 1분 · 익명</p>
          <button className={s.primary} onClick={() => setStep("form")} autoFocus>설문 참여할게요</button>
          <button className={s.secondary} onClick={later}>다음에 할게요</button>
        </div>
      </div>
    );

  return (
    <div className={s.dim} onClick={later}>
      <div className={s.sheet} role="dialog" aria-modal="true" aria-labelledby="fb-form" onClick={(e) => e.stopPropagation()}>
        <div className={s.grab} />
        <div className={s.head}>
          <b id="fb-form">서비스 개선 설문</b>
          <button className={s.close} onClick={later} aria-label="닫기">✕</button>
        </div>
        <div className={s.prog}><i style={{ width: `${(answered / 3) * 100}%` }} /></div>
        <div className={s.scroll}>
          <div className={s.q}>
            <div className={s.qt}><span className={s.n}>1</span>원하는 공고를 찾는 과정이 쉬웠나요?</div>
            <Scale value={ease} set={setEase} lo="어려웠어요" hi="쉬웠어요" label="찾기 쉬움" />
          </div>
          <div className={s.q}>
            <div className={s.qt}><span className={s.n}>2</span>추천 결과가 내 상황과 잘 맞았나요?</div>
            <Scale value={fit} set={setFit} lo="안 맞았어요" hi="잘 맞았어요" label="결과 적합도" />
          </div>
          <div className={s.q}>
            <div className={s.qt}><span className={s.n}>3</span>가장 불편했던 화면은? <span className={s.opt}>(선택)</span></div>
            <div className={s.chips}>
              {SCREENS.map((v) => (
                <button key={v} aria-pressed={screen === v} className={screen === v ? s.chipOn : ""} onClick={() => setScreen(screen === v ? "" : v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className={s.q}>
            <div className={s.qt}><span className={s.n}>4</span>다시 사용할 의향이 있나요?</div>
            <div className={s.chips}>
              {REUSE.map((v) => (
                <button key={v} aria-pressed={reuse === v} className={reuse === v ? s.chipOn : ""} onClick={() => setReuse(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className={s.q}>
            <label htmlFor="fb-comment" className={s.qt}><span className={s.n}>5</span>개선했으면 하는 점 한 줄 <span className={s.opt}>(선택)</span></label>
            <textarea id="fb-comment" className={s.area} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="예) 질문이 조금 더 짧았으면 좋겠어요" />
            <div className={s.hint}>이름·연락처 등 개인정보는 적지 마세요.</div>
          </div>
        </div>
        <div className={s.foot}>
          {error && <p className={s.error}>{error}</p>}
          <button className={s.primary} disabled={!ready || sending} onClick={submit}>
            {sending ? "보내는 중…" : ready ? "제출하기" : "1·2·4번에 답해 주세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
