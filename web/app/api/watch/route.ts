// 조건·푸시 구독을 서버에 저장(POST)하고, 반복 리서치 상태를 돌려준다(GET). POST ?scan=1 은 지금 바로 1회 조사. DELETE는 삭제.
// 인증: 처음 저장할 때 클라이언트가 만든 비밀 토큰의 해시를 저장하고, 이후 모든 요청은 같은 토큰(Bearer)이 있어야 합니다.
import type { Watch } from "@/lib/types";
import { deleteRecord, getLastCronAt, getRecord, persistent, putRecord, type WatchRecord } from "@/lib/server/store";
import { scanOne } from "@/lib/server/scan";
import { bearer, hashToken, tokenMatches, validSubscription } from "@/lib/server/security";
import { approximateLocation } from "@/lib/geo/distance";
import { normalizeSchedule } from "@/lib/server/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const lastManual = new Map<string, number>();

async function status(rec: WatchRecord | null) {
  if (!rec) return { saved: false };
  const p = persistent();
  return {
    saved: true,
    persistent: p,
    pushEnabled: Boolean(rec.subscription),
    lastScanAt: rec.lastScanAt ?? null,
    lastSources: rec.lastSources ?? [],
    lastNewTitles: rec.lastNewTitles ?? [],
    totalNew: rec.totalNew,
    schedule: p ? "저장한 일정에 따라 자동 조사" : "데모 모드: 서버가 재시작되면 저장한 조건이 사라집니다",
    history: rec.history ?? [],
    lastCronAt: await getLastCronAt(),
  };
}

function validWatch(w: Watch | undefined): w is Watch {
  return Boolean(
    w &&
      Array.isArray(w.answers) &&
      Array.isArray(w.domains) &&
      Array.isArray(w.seenIds) &&
      w.answers.length <= 200 && // 추가 질문·분야 범위까지 합치면 40개를 넘는다
      w.seenIds.length <= 2000 &&
      (!w.location ||
        (Number.isFinite(w.location.lat) &&
          Number.isFinite(w.location.lng) &&
          w.location.lat >= -90 &&
          w.location.lat <= 90 &&
          w.location.lng >= -180 &&
          w.location.lng <= 180 &&
          (w.location.radiusKm === null || [1, 2, 5, 10].includes(w.location.radiusKm)))) &&
      (!w.mode || w.mode === "new-only" || w.mode === "digest"),
  );
}

async function authorized(req: Request, id: string): Promise<{ rec: WatchRecord | null; ok: boolean }> {
  const rec = await getRecord(id);
  return { rec, ok: !rec || tokenMatches(bearer(req), rec.tokenHash) };
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return Response.json({ error: "잘못된 id" }, { status: 400 });
  const { rec, ok } = await authorized(req, id);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  // 앱 접속 = 보관 기간 연장(마지막 접속 후 14일 지나면 삭제)
  if (rec) await putRecord({ ...rec, lastSeenAt: new Date().toISOString() });
  return Response.json(await status(rec));
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return Response.json({ error: "잘못된 id" }, { status: 400 });
  const { rec, ok } = await authorized(req, id);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (rec) await deleteRecord(id);
  return Response.json({ deleted: true });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: { id?: string; watch?: Watch; subscription?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!ID_RE.test(id)) return Response.json({ error: "잘못된 id" }, { status: 400 });
  const token = bearer(req);
  if (!token || token.length < 16) return Response.json({ error: "unauthorized" }, { status: 401 });

  const auth = await authorized(req, id);
  let rec = auth.rec;
  if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (body.watch !== undefined) {
    if (!validWatch(body.watch)) return Response.json({ error: "조건 형식 오류" }, { status: 400 });
    const w = body.watch;
    // 서버가 이미 본 공고는 유지(오래된 클라이언트 값으로 덮어써 같은 공고를 다시 알리지 않도록)
    const seen = [...new Set([...(rec?.watch.seenIds ?? []), ...w.seenIds])].slice(-1000);
    rec = {
      ...(rec ?? { totalNew: 0, tokenHash: hashToken(token) }),
      id,
      watch: {
        ...w,
        seenIds: seen,
        location: approximateLocation(w.location),
        schedule: normalizeSchedule(w.schedule),
        mode: w.mode ?? "new-only",
      },
    } as WatchRecord;
  }
  if (!rec) return Response.json({ error: "저장된 조건이 없습니다" }, { status: 404 });
  if (body.subscription !== undefined) {
    if (!validSubscription(body.subscription)) return Response.json({ error: "지원하지 않는 푸시 구독" }, { status: 400 });
    rec.subscription = body.subscription;
  }
  rec.lastSeenAt = new Date().toISOString();
  await putRecord(rec);

  if (url.searchParams.get("scan") === "1") {
    const now = Date.now();
    if (now - (lastManual.get(id) ?? 0) < 30_000) {
      return Response.json({ error: "30초 후에 다시 조사할 수 있습니다" }, { status: 429 });
    }
    lastManual.set(id, now);
    rec = await scanOne(rec);
  }
  return Response.json(await status(rec));
}
