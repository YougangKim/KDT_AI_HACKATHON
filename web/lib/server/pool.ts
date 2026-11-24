import type { Opportunity } from "@/lib/types";
import {
  ADAPTERS,
  ALL_DOMAINS,
  collectLiveOpportunities,
  type SourceRunMeta,
} from "@/lib/sources";
import { dedupeOpportunities } from "@/lib/sources/dedupe";
import { attachTags, carryTags, needsTags } from "@/lib/sources/classify";
import { jevEnabled } from "@/lib/ai/jev";
import { allFacets } from "@/lib/server/facets";

const META_KEY = "pool:v1:meta";
const MAX_CHUNK_BYTES = 900 * 1024;
/** 조각 수가 바뀌어 안 쓰게 된 예전 조각 키를 남겨 두는 시간(초) */
const STALE_CHUNK_TTL_S = 600;
const SOURCE_INTERVAL_MS: Record<string, number> = {
  gov24: 6 * 60 * 60 * 1000,
};
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

export interface PoolSourceMeta extends SourceRunMeta {
  collectedAt?: string;
  chunks?: number;
  /** 조각 키 세대(수집마다 새 값). 예전 세대 키는 다시 쓰이지 않아 만료를 걸어도 안전 */
  gen?: string;
}

export interface PoolMeta {
  collectedAt: string;
  sources: Record<string, PoolSourceMeta>;
}

export interface PoolSnapshot {
  meta: PoolMeta;
  items: Opportunity[];
}

interface FileSnapshot {
  meta: PoolMeta;
  sources: Record<string, Opportunity[]>;
}

const memory: FileSnapshot = {
  meta: { collectedAt: "", sources: {} },
  sources: {},
};
let collection: Promise<PoolMeta> | null = null;

const redisUrl = () =>
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = () =>
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

async function redis(command: (string | number)[]): Promise<unknown> {
  const response = await fetch(redisUrl()!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`redis ${response.status}`);
  return ((await response.json()) as { result: unknown }).result;
}

function fileEnabled(): boolean {
  return process.env.POOL_CACHE_DISABLE_FILE !== "1" && !process.env.VERCEL;
}

async function filePath(): Promise<string> {
  const { join } = await import("node:path");
  return join(process.cwd(), ".cache", "pool-v1.json");
}

async function readFileSnapshot(): Promise<FileSnapshot | null> {
  if (!fileEnabled()) return memory.meta.collectedAt ? memory : null;
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(await filePath(), "utf8")) as FileSnapshot;
  } catch {
    return memory.meta.collectedAt ? memory : null;
  }
}

async function writeFileSnapshot(snapshot: FileSnapshot): Promise<void> {
  memory.meta = snapshot.meta;
  memory.sources = snapshot.sources;
  if (!fileEnabled()) return;
  try {
    const { dirname } = await import("node:path");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await filePath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(snapshot), "utf8");
  } catch {
    // Vercel 또는 읽기 전용 파일시스템에서는 메모리 저장본을 사용합니다.
  }
}

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function splitPoolChunks(items: Opportunity[]): Opportunity[][] {
  const chunks: Opportunity[][] = [];
  let current: Opportunity[] = [];
  for (const item of items) {
    if (current.length && bytes([...current, item]) > MAX_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length || !chunks.length) chunks.push(current);
  return chunks;
}

async function readRedisMeta(): Promise<PoolMeta | null> {
  const raw = await redis(["GET", META_KEY]) as string | null;
  return raw ? JSON.parse(raw) as PoolMeta : null;
}

/** 출처 조각 키 목록. 세대(gen)가 있으면 세대별 키, 없으면 예전 형식(단일 키 또는 번호 조각) */
function sourceKeys(source: string, chunks = 1, gen?: string): string[] {
  if (gen) return Array.from({ length: chunks }, (_, index) => `pool:v1:${source}:${gen}:${index}`);
  if (chunks <= 1) return [`pool:v1:${source}`];
  return Array.from({ length: chunks }, (_, index) => `pool:v1:${source}:${index}`);
}

async function readRedisSource(source: string, chunks = 1, gen?: string): Promise<Opportunity[]> {
  const values = await Promise.all(sourceKeys(source, chunks, gen).map((key) => redis(["GET", key]) as Promise<string | null>));
  return values.flatMap((raw) => raw ? JSON.parse(raw) as Opportunity[] : []);
}

let genSeq = 0;
/**
 * 출처 하나를 새 세대 키에 조각으로 저장한다. 예전 세대 키는 바로 지우지 않고 돌려준다:
 * meta를 바꾸기 전에 지우거나 같은 키를 덮어쓰면, 그 사이 예전 meta를 읽은 요청이 빈 출처·섞인 조각을 보기 때문.
 * 세대가 매번 달라 예전 키가 다시 쓰이지 않으므로, 동시 수집이 겹쳐도 만료가 현재 키에 걸리지 않는다
 */
async function writeRedisSource(
  source: string,
  items: Opportunity[],
  previous: PoolSourceMeta | undefined,
): Promise<{ chunks: number; gen: string; stale: string[] }> {
  const chunks = splitPoolChunks(items);
  const gen = `g${Date.now().toString(36)}${(genSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const keys = sourceKeys(source, chunks.length, gen);
  await Promise.all(chunks.map((chunk, index) => redis(["SET", keys[index], JSON.stringify(chunk)])));
  return { chunks: chunks.length, gen, stale: sourceKeys(source, previous?.chunks ?? 1, previous?.gen) };
}

async function readSnapshot(): Promise<FileSnapshot | null> {
  if (!redisUrl() || !redisToken()) return readFileSnapshot();
  try {
    const meta = await readRedisMeta();
    if (!meta) return null;
    const entries = await Promise.all(Object.entries(meta.sources).map(async ([source, status]) => [
      source,
      await readRedisSource(source, status.chunks ?? 1, status.gen),
    ] as const));
    return { meta, sources: Object.fromEntries(entries) };
  } catch {
    return readFileSnapshot();
  }
}

export async function readPool(): Promise<PoolSnapshot | null> {
  const snapshot = await readSnapshot();
  if (!snapshot?.meta.collectedAt) return null;
  return {
    meta: snapshot.meta,
    items: dedupeOpportunities(Object.values(snapshot.sources).flat()),
  };
}

async function writeSnapshot(
  snapshot: FileSnapshot,
  changedSources: Set<string>,
  previous: FileSnapshot | null,
): Promise<void> {
  if (!redisUrl() || !redisToken()) {
    await writeFileSnapshot(snapshot);
    return;
  }
  try {
    const stale: string[] = [];
    for (const source of changedSources) {
      const written = await writeRedisSource(source, snapshot.sources[source] ?? [], previous?.meta.sources[source]);
      snapshot.meta.sources[source].chunks = written.chunks;
      snapshot.meta.sources[source].gen = written.gen;
      stale.push(...written.stale);
    }
    await redis(["SET", META_KEY, JSON.stringify(snapshot.meta)]);
    // 예전 세대 조각은 바로 지우지 않고 10분 뒤 만료시킨다: 새 meta 저장 직전에 예전 meta를 읽은 요청도 그 조각을 끝까지 읽을 수 있게.
    // 세대 키는 다시 쓰이지 않으므로 동시 수집이 겹쳐도 현재 키에 만료가 걸리지 않는다
    for (const key of stale) await redis(["EXPIRE", key, STALE_CHUNK_TTL_S]);
  } catch {
    await writeFileSnapshot(snapshot);
  }
}

const LOCK_KEY = "pool:v1:lock";
/** 수집 1회 최대 시간(cron 제한 300초)보다 조금 길게. 비정상 종료해도 이 시간 뒤 풀린다 */
const LOCK_TTL_S = 330;

/**
 * 공고 풀 수집. 여러 서버 인스턴스(cron·화면 요청 트리거)가 동시에 수집하면 meta를 서로 덮어써
 * 한쪽 조각 키가 만료되거나 고아가 될 수 있어, Upstash 락으로 한 번에 하나만 수집한다(락을 못 잡으면 저장본 그대로)
 */
export async function collectPool(now = new Date()): Promise<PoolMeta> {
  if (!redisUrl() || !redisToken()) return collectPoolUnlocked(now);
  const token = `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  const got = await redis(["SET", LOCK_KEY, token, "NX", "EX", LOCK_TTL_S]).catch(() => null);
  if (got !== "OK") return (await readSnapshot())?.meta ?? { collectedAt: "", sources: {} };
  try {
    return await collectPoolUnlocked(now);
  } finally {
    // 내 락일 때만 푼다(만료 뒤 다른 수집이 잡은 락을 지우지 않게)
    if ((await redis(["GET", LOCK_KEY]).catch(() => null)) === token) await redis(["DEL", LOCK_KEY]).catch(() => null);
  }
}

async function collectPoolUnlocked(now: Date): Promise<PoolMeta> {
  const previous = await readSnapshot();
  const due = ADAPTERS.filter((adapter) => {
    // 키 등록 전 건너뛴 출처는 새 키가 있으면 주기와 무관하게 첫 수집합니다.
    if (previous?.meta.sources[adapter.id]?.calls === 0 && process.env[adapter.envKey]) return true;
    const collectedAt = previous?.meta.sources[adapter.id]?.collectedAt;
    if (!collectedAt) return true;
    const interval = SOURCE_INTERVAL_MS[adapter.id] ?? DEFAULT_INTERVAL_MS;
    return now.getTime() - new Date(collectedAt).getTime() >= interval;
  });
  // 분류하지 않은 칼럼이 남은 공고(분류 도입 전·새 질문 칼럼 등록·Jev 실패)가 있으면 수집할 출처가 없어도 분류만 보충한다
  const facets = jevEnabled() ? await allFacets() : [];
  const untagged = jevEnabled() && Object.values(previous?.sources ?? {}).some((list) => list.some((o) => needsTags(o, facets)));
  if (!due.length && previous && !untagged) return previous.meta;

  const statuses = new Map<string, SourceRunMeta>();
  const items = await collectLiveOpportunities(ALL_DOMAINS, now, {
    full: true,
    waitAi: true,
    adapters: due,
    onSource: (status) => statuses.set(status.source, status),
  });
  const grouped = Object.groupBy(items, (item) => item.source);
  const next: FileSnapshot = {
    meta: {
      collectedAt: now.toISOString(),
      sources: { ...(previous?.meta.sources ?? {}) },
    },
    sources: { ...(previous?.sources ?? {}) },
  };
  const changedSources = new Set<string>();

  for (const adapter of due) {
    const status = statuses.get(adapter.id) ?? {
      source: adapter.id,
      ok: false,
      count: 0,
      durationMs: 0,
      calls: 0,
      error: "수집 결과 없음",
    };
    if (status.ok) {
      // 다시 모은 공고도 이전 DB의 분류 칼럼을 그대로 옮긴다(같은 공고를 다시 분류하지 않음)
      const sourceItems = carryTags(grouped[adapter.id] ?? [], previous?.sources[adapter.id] ?? []);
      next.sources[adapter.id] = sourceItems;
      next.meta.sources[adapter.id] = {
        ...status,
        count: sourceItems.length,
        collectedAt: now.toISOString(),
        chunks: previous?.meta.sources[adapter.id]?.chunks ?? 1,
      };
      changedSources.add(adapter.id);
    } else {
      next.meta.sources[adapter.id] = {
        ...status,
        count: previous?.sources[adapter.id]?.length ?? 0,
        collectedAt: previous?.meta.sources[adapter.id]?.collectedAt,
        chunks: previous?.meta.sources[adapter.id]?.chunks ?? 1,
        gen: previous?.meta.sources[adapter.id]?.gen, // 이번에 안 바뀐 출처는 예전 세대 키를 그대로 읽는다
      };
    }
  }

  // DB에 넣기 전 분류: 새 공고와 아직 분류하지 않은 칼럼만 Jev에 묻는다(한 번에 최대 400요청, 나머지는 다음 수집 때)
  if (jevEnabled()) {
    let budget = 400;
    // cron 제한(300초) 안에 끝나도록 분류는 시작 후 150초까지만 새 요청을 보낸다
    const deadline = Date.now() + 150_000;
    for (const [source, list] of Object.entries(next.sources)) {
      if (budget <= 0 || Date.now() >= deadline) break;
      if (!list.some((o) => needsTags(o, facets))) continue;
      const done = await attachTags(list, facets, { limit: budget, deadline });
      budget -= done.asked;
      next.sources[source] = done.items;
      changedSources.add(source);
    }
  }

  await writeSnapshot(next, changedSources, previous);
  return next.meta;
}

export function triggerPoolCollection(now = new Date()): void {
  if (collection) return;
  collection = collectPool(now)
    .catch((error) => {
      console.warn("[pool] 백그라운드 수집 실패:", (error as Error).message);
      return { collectedAt: "", sources: {} };
    })
    .finally(() => {
      collection = null;
    });
}

export function publicPoolMeta(meta: PoolMeta): PoolMeta {
  return {
    collectedAt: meta.collectedAt,
    sources: Object.fromEntries(Object.entries(meta.sources).map(([source, value]) => [
      source,
      {
        source,
        ok: value.ok,
        count: value.count,
        durationMs: value.durationMs,
        calls: value.calls,
        error: value.error,
        collectedAt: value.collectedAt,
      },
    ])),
  };
}

export function _clearPoolMemory(): void {
  memory.meta = { collectedAt: "", sources: {} };
  memory.sources = {};
  collection = null;
}
