// Vercel Cron이 매일 호출: 저장된 모든 조건으로 반복 리서치 → 새 공고 푸시
import { scanAll } from "@/lib/server/scan";

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
  const result = await scanAll();
  return Response.json({ ok: true, at: new Date().toISOString(), ...result });
}
