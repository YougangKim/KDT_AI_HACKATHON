// 서버 저장소: 조건(Watch)·푸시 구독·조사 기록. Upstash Redis REST 키가 있으면 사용, 없으면 메모리(로컬 데모용).
import type { Watch } from "@/lib/types";
import type { ScanSnapshot } from "@/lib/insight/types";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WatchRecord {
  id: string;
  watch: Watch;
  subscription?: PushSub;
  lastScanAt?: string;
  lastSources?: string[];
  lastNewTitles?: string[];
  totalNew: number;
  history?: ScanSnapshot[]; // 최근 조사 기록(주간 리포트용, 최대 30개)
  tokenHash?: string; // 소유자 토큰 sha256(원문은 저장하지 않음)
  known?: import("./changes").Known; // 공고별 마지막 마감일·D-3 알림 여부
  lastSeenAt?: string; // 사용자가 마지막으로 앱에 접속한 시각(자동 조사는 갱신하지 않음)
}

/** 마지막 접속 후 이 기간이 지나면 저장된 조건·알림 구독을 지운다 */
export const IDLE_DAYS = 14;
const IDLE_MS = IDLE_DAYS * 24 * 60 * 60 * 1000;
/** 기록이 미접속 기간을 넘겼는지(예전 기록에 lastSeenAt이 없으면 Redis 만료에 맡긴다) */
export const idleExpired = (r: WatchRecord, now = Date.now()) => !!r.lastSeenAt && now - Date.parse(r.lastSeenAt) > IDLE_MS;

// Vercel의 Upstash 연동은 KV_REST_API_* 이름으로 넣는다
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const memory = new Map<string, WatchRecord>();
const INDEX = "watch:index";
const LAST_CRON = "watch:last-cron";
let memoryLastCron: string | null = null;

export async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

export const persistent = () => Boolean(URL_ && TOKEN);

export async function getRecord(id: string): Promise<WatchRecord | null> {
  let rec: WatchRecord | null;
  if (!persistent()) rec = memory.get(id) ?? null;
  else {
    const raw = (await redis(["GET", `watch:${id}`])) as string | null;
    rec = raw ? (JSON.parse(raw) as WatchRecord) : null;
  }
  if (rec && idleExpired(rec)) {
    await deleteRecord(id);
    return null;
  }
  return rec;
}

export async function putRecord(r: WatchRecord): Promise<void> {
  // 예전 기록(접속 시각 없음)은 지금부터 14일을 센다. 자동 조사로 계속 연장되지 않게 시각을 기록에 남긴다
  if (!r.lastSeenAt) r = { ...r, lastSeenAt: new Date().toISOString() };
  if (!persistent()) {
    if (idleExpired(r)) {
      memory.delete(r.id);
      return;
    }
    memory.set(r.id, r);
    return;
  }
  // 만료 시각 = 마지막 접속 + 14일(자동 조사로 다시 저장해도 연장되지 않음)
  const ttl = Math.floor((Date.parse(r.lastSeenAt!) + IDLE_MS - Date.now()) / 1000);
  if (ttl <= 0) {
    await deleteRecord(r.id);
    return;
  }
  await redis(["SET", `watch:${r.id}`, JSON.stringify(r), "EX", ttl]);
  await redis(["SADD", INDEX, r.id]);
}

export async function deleteRecord(id: string): Promise<void> {
  if (!persistent()) {
    memory.delete(id);
    return;
  }
  await redis(["DEL", `watch:${id}`]);
  await redis(["SREM", INDEX, id]);
}

export async function allIds(): Promise<string[]> {
  if (!persistent()) return [...memory.keys()];
  return ((await redis(["SMEMBERS", INDEX])) as string[]) ?? [];
}

export async function setLastCronAt(value: string): Promise<void> {
  if (!persistent()) {
    memoryLastCron = value;
    return;
  }
  await redis(["SET", LAST_CRON, value]);
}

export async function getLastCronAt(): Promise<string | null> {
  if (!persistent()) return memoryLastCron;
  return (await redis(["GET", LAST_CRON])) as string | null;
}
