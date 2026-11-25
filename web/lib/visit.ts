// 기기(브라우저) 단위 익명 식별: IP를 쓰지 않고, 이 기기 브라우저 저장소에만 지난 인터뷰 결과·조건을 둔다.
// 마지막 방문 후 14일이 지나 다시 오면 이 기기에 남은 결과·조건·알림 기록을 지운다(서버 쪽 조건은 서버가 14일 미접속 시 삭제).
export const IDLE_DAYS = 14;
const IDLE_MS = IDLE_DAYS * 24 * 60 * 60 * 1000;
const VISIT_KEY = "lastVisitAt";
/** 오래 안 오면 지우는 이 기기 저장 항목(지난 인터뷰 결과·알림 조건·알림 기록·익명 알림 ID) */
export const STORED_KEYS = ["lastResult", "watch", "alertLog", "hardConditions", "watchId", "watchToken"];

/** 방문 기록을 갱신한다. 14일 넘게 안 왔으면 저장 항목을 먼저 지우고 true를 돌려준다 */
export function touchVisit(now = Date.now(), storage: Storage | null = safeLocal()): boolean {
  if (!storage) return false;
  let expired = false;
  try {
    const last = Number(storage.getItem(VISIT_KEY));
    if (last > 0 && now - last > IDLE_MS) {
      for (const key of STORED_KEYS) storage.removeItem(key);
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith("prep:")) storage.removeItem(key);
      }
      expired = true;
    }
    storage.setItem(VISIT_KEY, String(now));
  } catch {}
  return expired;
}

function safeLocal(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
