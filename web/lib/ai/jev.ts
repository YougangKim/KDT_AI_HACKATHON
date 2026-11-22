// TypeSafe Jev(판단 전용 모델) — 예/아니오 확률만 돌려받는다. JEV_API_KEY가 있을 때만 동작, 실패하면 null.
// 문서: https://docs.typesafe.ai/api/system-one.md (POST /v1/systemone, Noul 질문 → answers[name].noul)
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL || "jev-latest";

export function jevEnabled(): boolean {
  return Boolean(process.env.JEV_API_KEY);
}

/** 여러 예/아니오 질문을 한 번에 묻는다. 반환: 이름별 '예' 확률(0~1). 실패하면 null */
export async function judgeYes(state: string | object, questions: Record<string, string>): Promise<Record<string, number> | null> {
  if (!jevEnabled() || Object.keys(questions).length === 0) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        state,
        questions: Object.fromEntries(Object.entries(questions).map(([k, q]) => [k, { type: "noul", instructions: q }])),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { answers?: Record<string, { noul?: number }> };
    const out: Record<string, number> = {};
    for (const k of Object.keys(questions)) {
      const p = data.answers?.[k]?.noul;
      if (typeof p === "number") out[k] = p;
    }
    return out;
  } catch (e) {
    console.warn("[jev] 판단 실패, 건너뜀:", (e as Error).message);
    return null;
  }
}
