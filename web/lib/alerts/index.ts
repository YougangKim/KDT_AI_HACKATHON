// 공개 인터페이스(CONTRACT.md): saveWatch, loadWatch, findNew
import type { Watch } from "@/lib/types";
import type { AlertItem } from "./core";

export * from "./core";

const WATCH_KEY = "watch";
const LOG_KEY = "alertLog";
const MAX_LOG = 50;

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 불가(사생활 모드 등)면 무시
  }
}

export function saveWatch(w: Watch): void {
  writeJson(WATCH_KEY, w);
}

export function loadWatch(): Watch | null {
  return readJson<Watch | null>(WATCH_KEY, null);
}

export function clearWatch(): void {
  try {
    store()?.removeItem(WATCH_KEY);
  } catch {}
}

export function markSeen(w: Watch, ids: string[]): Watch {
  const next = { ...w, seenIds: Array.from(new Set([...w.seenIds, ...ids])) };
  saveWatch(next);
  return next;
}

export function loadAlertLog(): AlertItem[] {
  return readJson<AlertItem[]>(LOG_KEY, []).filter((a) => !/^(demo:|fixture:|sample:)|:sample-/.test(a.opportunityId));
}

export function addAlerts(items: AlertItem[]): AlertItem[] {
  const next = [...items, ...loadAlertLog()].slice(0, MAX_LOG);
  writeJson(LOG_KEY, next);
  return next;
}

export function markAllRead(): AlertItem[] {
  const next = loadAlertLog().map((a) => ({ ...a, read: true }));
  writeJson(LOG_KEY, next);
  return next;
}

export function unreadCount(): number {
  return loadAlertLog().filter((a) => !a.read).length;
}

