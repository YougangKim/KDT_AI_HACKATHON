import { createHash } from "node:crypto";

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

type CacheFile = Record<string, CacheEntry>;

const memory = new Map<string, CacheEntry>();
const locks = new Map<string, Promise<void>>();

const redisUrl = () =>
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = () =>
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export function cacheKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function id(ns: string, key: string): string {
  return `${ns}:${cacheKey(key)}`;
}

function valid(entry: CacheEntry | null | undefined): entry is CacheEntry {
  return Boolean(entry && entry.expiresAt > Date.now());
}

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
  return process.env.AI_CACHE_DISABLE_FILE !== "1" && !process.env.VERCEL;
}

async function filePath(ns: string): Promise<string> {
  const { join } = await import("node:path");
  return join(process.cwd(), ".cache", `ai-${ns}.json`);
}

async function readFile(ns: string): Promise<CacheFile> {
  if (!fileEnabled()) return {};
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(await filePath(ns), "utf8")) as CacheFile;
  } catch {
    return {};
  }
}

async function writeFile(ns: string, value: CacheFile): Promise<void> {
  if (!fileEnabled()) return;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await filePath(ns);
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value), "utf8");
}

export async function getCached<T>(ns: string, key: string): Promise<T | null> {
  const cacheId = id(ns, key);

  if (redisUrl() && redisToken()) {
    try {
      const raw = await redis(["GET", `ai:${cacheId}`]) as string | null;
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // Upstash 장애 시 개발 파일 또는 메모리로 계속 진행한다.
    }
  }

  if (fileEnabled()) {
    const entry = (await readFile(ns))[cacheId];
    if (valid(entry)) return entry.value as T;
  }

  const entry = memory.get(cacheId);
  if (valid(entry)) return entry.value as T;
  if (entry) memory.delete(cacheId);
  return null;
}

export async function setCached(
  ns: string,
  key: string,
  value: unknown,
  ttlDays: number,
): Promise<void> {
  const cacheId = id(ns, key);
  const ttlSeconds = Math.max(1, Math.round(ttlDays * 86_400));
  const entry = { expiresAt: Date.now() + ttlSeconds * 1000, value };
  memory.set(cacheId, entry);

  if (redisUrl() && redisToken()) {
    try {
      await redis(["SET", `ai:${cacheId}`, JSON.stringify(value), "EX", ttlSeconds]);
      return;
    } catch {
      // Upstash 장애 시 개발 파일 또는 메모리에 남긴다.
    }
  }

  if (!fileEnabled()) return;
  const previous = locks.get(ns) ?? Promise.resolve();
  const next = previous.then(async () => {
    const file = await readFile(ns);
    file[cacheId] = entry;
    await writeFile(ns, file);
  });
  locks.set(ns, next.catch(() => {}));
  await next;
}

export function _clearAiCacheMemory(): void {
  memory.clear();
  locks.clear();
}
