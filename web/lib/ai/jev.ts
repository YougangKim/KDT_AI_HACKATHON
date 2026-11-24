// TypeSafe Jev(판단 전용 모델) — 글을 쓰지 않고 고르기(choice)·예/아니오 확률(noul)만 돌려받는다.
// JEV_API_KEY가 있을 때만 동작, 실패하면 null. 숫자·날짜 비교는 약하므로 맡기지 않는다.
// 문서: https://docs.typesafe.ai/api/system-one.md (POST /v1/systemone)
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL || "jev-latest";

export function jevEnabled(): boolean {
  return Boolean(process.env.JEV_API_KEY);
}

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number };

/** 한 상태(state)에 여러 질문을 한 번에 묻는다. 실패하면 null */
export async function askJev(state: string | object, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer> | null> {
  if (!jevEnabled() || Object.keys(questions).length === 0) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { answers?: Record<string, { type?: string; noul?: number; choice?: string; confidence?: number }> };
    const out: Record<string, JevAnswer> = {};
    for (const [k, q] of Object.entries(questions)) {
      const a = data.answers?.[k];
      if (q.type === "noul" && typeof a?.noul === "number") out[k] = { type: "noul", noul: a.noul };
      if (q.type === "choice" && typeof a?.choice === "string" && a.choice in q.criteria)
        out[k] = { type: "choice", choice: a.choice, confidence: typeof a.confidence === "number" ? a.confidence : 0 };
    }
    return out;
  } catch (e) {
    console.warn("[jev] 판단 실패, 건너뜀:", (e as Error).message);
    return null;
  }
}

/** 여러 예/아니오 질문을 한 번에 묻는다. 반환: 이름별 '예' 확률(0~1). 실패하면 null */
export async function judgeYes(state: string | object, questions: Record<string, string>): Promise<Record<string, number> | null> {
  const answers = await askJev(state, Object.fromEntries(Object.entries(questions).map(([k, q]) => [k, { type: "noul" as const, instructions: q }])));
  if (!answers) return null;
  const out: Record<string, number> = {};
  for (const [k, a] of Object.entries(answers)) if (a.type === "noul") out[k] = a.noul;
  return out;
}
