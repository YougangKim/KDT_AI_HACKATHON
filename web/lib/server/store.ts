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
}

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = new Map<string, WatchRecord>();
const INDEX = "watch:index";

async function redis(cmd: (string | number)[]): Promise<unknown> {
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
  if (!persistent()) return memory.get(id) ?? null;
  const raw = (await redis(["GET", `watch:${id}`])) as string | null;
  return raw ? (JSON.parse(raw) as WatchRecord) : null;
}

export async function putRecord(r: WatchRecord): Promise<void> {
  if (!persistent()) {
    memory.set(r.id, r);
    return;
  }
  await redis(["SET", `watch:${r.id}`, JSON.stringify(r), "EX", 60 * 60 * 24 * 60]);
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
