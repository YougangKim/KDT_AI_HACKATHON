import { collectPool, publicPoolMeta } from "@/lib/server/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function collect(req: Request) {
  const secret = process.env.CRON_SECRET;
  const local = process.env.E2E_LOCAL === "1" || process.env.NODE_ENV !== "production";
  if (!secret && !local) {
    return Response.json({ error: "cron not configured" }, { status: 503 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const meta = await collectPool(new Date());
  return Response.json({ ok: true, ...publicPoolMeta(meta) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = collect;
export const POST = collect;
