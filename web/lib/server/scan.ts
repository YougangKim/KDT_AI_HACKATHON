// 반복 리서치: 저장된 조건으로 여러 출처를 다시 조회 → 새 공고만 골라 푸시 → 본 것으로 기록
import * as webpush from "web-push";
import { findNew } from "@/lib/alerts/core";
import { getMatches } from "@/lib/engine";
import type { Domain } from "@/lib/types";
import { loadOpportunities } from "@/lib/sources";
import { allIds, deleteRecord, getRecord, putRecord, type WatchRecord } from "./store";

function vapidReady(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:demo@example.com", pub, priv);
  return true;
}

export async function scanOne(rec: WatchRecord, now = new Date()): Promise<WatchRecord> {
  const pool = await loadOpportunities(rec.watch.domains.length ? rec.watch.domains : undefined);
  const fresh = findNew(rec.watch, pool, now);
  const byDomainNew: Partial<Record<Domain, number>> = {};
  for (const o of fresh) byDomainNew[o.domain] = (byDomainNew[o.domain] ?? 0) + 1;
  const snapshot = {
    at: now.toISOString(),
    total: pool.length,
    passed: getMatches({ pool, answers: rec.watch.answers }).length,
    newCount: fresh.length,
    byDomainNew,
    failedSources: [...new Set(pool.filter((o) => o.isSample).map((o) => o.source))],
  };
  const next: WatchRecord = {
    ...rec,
    history: [...(rec.history ?? []), snapshot].slice(-30),
    watch: { ...rec.watch, seenIds: [...new Set([...rec.watch.seenIds, ...fresh.map((o) => o.id)])].slice(-1000) },
    lastScanAt: now.toISOString(),
    lastSources: [...new Set(pool.map((o) => o.source))],
    lastNewTitles: fresh.slice(0, 5).map((o) => o.title),
    totalNew: rec.totalNew + fresh.length,
  };
  if (fresh.length > 0 && rec.subscription && vapidReady()) {
    try {
      await webpush.sendNotification(
        rec.subscription,
        JSON.stringify({
          title: `조건에 맞는 새 공고 ${fresh.length}건`,
          body: fresh
            .slice(0, 3)
            .map((o) => o.title)
            .join(" · ")
            .slice(0, 200),
          url: "/alerts",
        }),
      );
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) next.subscription = undefined; // 만료된 구독 정리
    }
  }
  await putRecord(next);
  return next;
}

export async function scanAll(now = new Date()): Promise<{ scanned: number; newTotal: number }> {
  let scanned = 0;
  let newTotal = 0;
  for (const id of await allIds()) {
    const rec = await getRecord(id);
    if (!rec) {
      await deleteRecord(id); // 만료된 레코드의 인덱스 정리
      continue;
    }
    const before = rec.totalNew;
    const after = await scanOne(rec, now);
    scanned++;
    newTotal += after.totalNew - before;
  }
  return { scanned, newTotal };
}
