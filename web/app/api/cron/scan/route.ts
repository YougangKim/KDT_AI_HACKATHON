// 외부 스케줄러가 매분 호출: 이번 시각에 due인 조건만 조사한다.
import { scanAll } from "@/lib/server/scan";
import { getLastCronAt, setLastCronAt } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const local = process.env.NODE_ENV !== "production";
  if (!secret && !local) return Response.json({ error: "cron not configured" }, { status: 503 });
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const lastCronAt = await getLastCronAt();
  if (
    lastCronAt &&
    now.getTime() - new Date(lastCronAt).getTime() < 30_000
  ) {
    return Response.json({ ok: true, skipped: true, at: now.toISOString() });
  }
  await setLastCronAt(now.toISOString());
  const result = await scanAll(now);
  return Response.json({ ok: true, at: now.toISOString(), ...result });
}
