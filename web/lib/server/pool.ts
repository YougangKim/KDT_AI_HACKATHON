import type { Opportunity } from "@/lib/types";
import {
  ADAPTERS,
  ALL_DOMAINS,
  collectLiveOpportunities,
  type SourceRunMeta,
} from "@/lib/sources";
import { dedupeOpportunities } from "@/lib/sources/dedupe";

const META_KEY = "pool:v1:meta";
const MAX_CHUNK_BYTES = 900 * 1024;
const SOURCE_INTERVAL_MS: Record<string, number> = {
  gov24: 6 * 60 * 60 * 1000,
};
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

export interface PoolSourceMeta extends SourceRunMeta {
  collectedAt?: string;
  chunks?: number;
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
    // Vercel 또는 읽기 전용 파일시스템에서는 메모리 저장본을 사용한다.
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

async function readRedisSource(source: string, chunks = 1): Promise<Opportunity[]> {
  if (chunks <= 1) {
    const raw = await redis(["GET", `pool:v1:${source}`]) as string | null;
    return raw ? JSON.parse(raw) as Opportunity[] : [];
  }
  const values = await Promise.all(
    Array.from({ length: chunks }, (_, index) =>
      redis(["GET", `pool:v1:${source}:${index}`]) as Promise<string | null>,
    ),
  );
  return values.flatMap((raw) => raw ? JSON.parse(raw) as Opportunity[] : []);
}

async function writeRedisSource(
  source: string,
  items: Opportunity[],
  previousChunks: number,
): Promise<number> {
  const chunks = splitPoolChunks(items);
  if (chunks.length === 1) {
    await redis(["SET", `pool:v1:${source}`, JSON.stringify(chunks[0])]);
    for (let index = 0; index < previousChunks; index++) {
      await redis(["DEL", `pool:v1:${source}:${index}`]);
    }
    return 1;
  }

  await Promise.all(chunks.map((chunk, index) =>
    redis(["SET", `pool:v1:${source}:${index}`, JSON.stringify(chunk)]),
  ));
  await redis(["DEL", `pool:v1:${source}`]);
  for (let index = chunks.length; index < previousChunks; index++) {
    await redis(["DEL", `pool:v1:${source}:${index}`]);
  }
  return chunks.length;
}

async function readSnapshot(): Promise<FileSnapshot | null> {
  if (!redisUrl() || !redisToken()) return readFileSnapshot();
  try {
    const meta = await readRedisMeta();
    if (!meta) return null;
    const entries = await Promise.all(Object.entries(meta.sources).map(async ([source, status]) => [
      source,
      await readRedisSource(source, status.chunks ?? 1),
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
    for (const source of changedSources) {
      const chunks = await writeRedisSource(
        source,
        snapshot.sources[source] ?? [],
        previous?.meta.sources[source]?.chunks ?? 1,
      );
      snapshot.meta.sources[source].chunks = chunks;
    }
    await redis(["SET", META_KEY, JSON.stringify(snapshot.meta)]);
  } catch {
    await writeFileSnapshot(snapshot);
  }
}

export async function collectPool(now = new Date()): Promise<PoolMeta> {
  const previous = await readSnapshot();
  const due = ADAPTERS.filter((adapter) => {
    const collectedAt = previous?.meta.sources[adapter.id]?.collectedAt;
    if (!collectedAt) return true;
    const interval = SOURCE_INTERVAL_MS[adapter.id] ?? DEFAULT_INTERVAL_MS;
    return now.getTime() - new Date(collectedAt).getTime() >= interval;
  });
  if (!due.length && previous) return previous.meta;

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
      const sourceItems = grouped[adapter.id] ?? [];
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
      };
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
