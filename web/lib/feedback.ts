// 피드백 설문: 입력 검증과 "다시 묻지 않기" 규칙(서버·클라이언트 공용)
export const SCREENS = ["홈", "질문", "결과", "지도", "알림 설정", "없었어요"] as const;
export const REUSE = ["예", "잘 모르겠어요", "아니오"] as const;

export interface Feedback {
  ease: number; // 1~5 찾기 쉬웠나
  fit: number; // 1~5 결과가 맞았나
  screen?: (typeof SCREENS)[number];
  reuse: (typeof REUSE)[number];
  comment?: string; // 최대 300자
  path?: string;
  ref?: string;
}

const score = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : null);
const short = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);

export function parseFeedback(input: unknown): Feedback | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const ease = score(o.ease);
  const fit = score(o.fit);
  const reuse = REUSE.find((r) => r === o.reuse);
  if (!ease || !fit || !reuse) return null;
  const screen = SCREENS.find((s) => s === o.screen);
  const path = short(o.path, 100);
  const ref = short(o.ref, 40)?.replace(/[^\w.-]/g, "");
  return {
    ease,
    fit,
    reuse,
    ...(screen && { screen }),
    ...(short(o.comment, 300) && { comment: short(o.comment, 300) }),
    ...(path?.startsWith("/") && { path }),
    ...(ref && { ref }),
  };
}

// 로컬 저장 상태: 제출하면 다시 묻지 않고, "다음에"는 7일 뒤 다시 묻는다
export const FEEDBACK_STATE = "mynews:feedback";
const WEEK = 7 * 24 * 60 * 60 * 1000;
export type FeedbackState = { done?: boolean; snoozedAt?: number };

export function shouldAsk(state: FeedbackState | null, now = Date.now()): boolean {
  if (!state) return true;
  if (state.done) return false;
  return !state.snoozedAt || now - state.snoozedAt >= WEEK;
}

// 관리자 조회용 집계(응답 수·평균 점수·재사용 의향·불편 화면 분포)
export function summarize(rows: Feedback[]) {
  const n = rows.length;
  const avg = (k: "ease" | "fit") => (n ? Math.round((rows.reduce((a, r) => a + r[k], 0) / n) * 100) / 100 : 0);
  const count = (pick: (r: Feedback) => string | undefined) =>
    rows.reduce<Record<string, number>>((m, r) => {
      const v = pick(r);
      if (v) m[v] = (m[v] ?? 0) + 1;
      return m;
    }, {});
  return { count: n, easeAvg: avg("ease"), fitAvg: avg("fit"), reuse: count((r) => r.reuse), screen: count((r) => r.screen), ref: count((r) => r.ref) };
}
