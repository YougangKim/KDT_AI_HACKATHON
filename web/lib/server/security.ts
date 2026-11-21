// 서버 보안 유틸: 소유자 토큰 해시 검증, 푸시 구독 검증
import { createHash, timingSafeEqual } from "node:crypto";
import type { PushSub } from "./store";

export const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string | null, hash: string | undefined): boolean {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearer(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}

export function validSubscription(sub: unknown): sub is PushSub {
  const s = sub as PushSub;
  if (!s?.endpoint || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return false;
  if (s.keys.p256dh.length > 256 || s.keys.auth.length > 128) return false;
  try {
    const u = new URL(s.endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
