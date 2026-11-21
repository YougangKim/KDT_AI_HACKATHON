// 브라우저 전용: 서비스워커·알림 권한·인앱 알림 확인·Web Push
import type { Domain, Opportunity } from "@/lib/types";
import { addAlerts, collectAlerts, demoOpportunity, loadAlertLog, loadWatch, markSeen, type AlertItem } from "./index";

export const ALERTS_EVENT = "alerts-changed";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

async function showNotification(a: AlertItem): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = { body: a.body, tag: a.id, data: { url: "/alerts" } };
  const reg = await registerSW();
  if (reg) {
    await reg.showNotification(a.title, options);
  } else {
    new Notification(a.title, options);
  }
}

export async function fetchPool(domains: Domain[]): Promise<Opportunity[]> {
  try {
    const q = domains.length ? `?domains=${domains.join(",")}` : "";
    const res = await fetch(`/api/opportunities${q}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Opportunity[]) : [];
  } catch {
    return [];
  }
}

/** 앱을 열 때 호출: 저장한 조건으로 새 공고·마감 임박을 찾아 기록하고 브라우저 알림을 띄운다 */
export async function checkAlerts(extraPool: Opportunity[] = []): Promise<AlertItem[]> {
  const w = loadWatch();
  if (!w) return [];
  const pool = [...extraPool, ...(await fetchPool(w.domains))];
  const items = collectAlerts(w, pool, loadAlertLog());
  if (items.length === 0) return [];
  addAlerts(items);
  markSeen(
    w,
    items.filter((a) => a.kind === "new").map((a) => a.opportunityId),
  );
  window.dispatchEvent(new Event(ALERTS_EVENT));
  for (const a of items.slice(0, 3)) await showNotification(a);
  return items;
}

/** 키 없이 동작하는 "새 공고 도착" 시연 */
export async function runDemo(): Promise<AlertItem[]> {
  const w = loadWatch();
  if (!w) return [];
  return checkAlerts([demoOpportunity(w)]);
}

// ---- Web Push (VAPID 키가 서버 env에 있을 때만) ----

export async function pushPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push");
    const data = (await res.json()) as { publicKey: string | null };
    return data.publicKey;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** 푸시 구독 후 서버에서 테스트 푸시를 보낸다. 실패하면 false */
export async function sendTestPush(publicKey: string): Promise<boolean> {
  const reg = await registerSW();
  if (!reg || !("pushManager" in reg)) return false;
  if ((await requestPermission()) !== "granted") return false;
  try {
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        title: "새 공고 도착 (푸시 테스트)",
        body: "저장한 조건에 맞는 공고가 올라오면 이렇게 알려 드려요.",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- 서버 반복 리서치(조건·구독을 서버에 저장 → 매일 자동 조사 → 새 공고 푸시) ----

export interface ResearchStatus {
  saved: boolean;
  persistent?: boolean;
  pushEnabled?: boolean;
  lastScanAt?: string | null;
  lastSources?: string[];
  lastNewTitles?: string[];
  totalNew?: number;
  schedule?: string;
  history?: import("@/lib/insight/types").ScanSnapshot[];
  error?: string;
}

function watchToken(): string {
  let t = localStorage.getItem("watchToken");
  if (!t) {
    t = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    localStorage.setItem("watchToken", t);
  }
  return t;
}

const authHeaders = () => ({ "content-type": "application/json", authorization: `Bearer ${watchToken()}` });

function watchId(): string {
  let id = localStorage.getItem("watchId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("watchId", id);
  }
  return id;
}

async function currentSubscription(): Promise<PushSubscriptionJSON | undefined> {
  const key = await pushPublicKey();
  if (!key || !notificationsSupported() || Notification.permission !== "granted") return undefined;
  const reg = await registerSW();
  if (!reg || !("pushManager" in reg)) return undefined;
  try {
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    return sub.toJSON();
  } catch {
    return undefined;
  }
}

/** 저장한 조건(+가능하면 푸시 구독)을 서버에 올린다. scan=true면 지금 바로 1회 조사 */
export async function syncWatch(scan = false): Promise<ResearchStatus> {
  const w = loadWatch();
  if (!w) return { saved: false };
  try {
    const res = await fetch(`/api/watch${scan ? "?scan=1" : ""}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: watchId(), watch: w, subscription: await currentSubscription() }),
    });
    return (await res.json()) as ResearchStatus;
  } catch {
    return { saved: false, error: "서버에 연결하지 못했어요" };
  }
}

export async function researchStatus(): Promise<ResearchStatus> {
  try {
    const res = await fetch(`/api/watch?id=${watchId()}`, { headers: authHeaders() });
    return (await res.json()) as ResearchStatus;
  } catch {
    return { saved: false };
  }
}

/** 서버에 저장된 조건·구독 삭제 */
export async function deleteServerWatch(): Promise<void> {
  try {
    await fetch(`/api/watch?id=${watchId()}`, { method: "DELETE", headers: authHeaders() });
  } catch {}
}
