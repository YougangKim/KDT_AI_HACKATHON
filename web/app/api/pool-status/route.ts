import { publicPoolMeta, readPool } from "@/lib/server/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pool = await readPool();
  return Response.json(
    pool ? publicPoolMeta(pool.meta) : { collectedAt: null, sources: {} },
    { headers: { "Cache-Control": "no-store" } },
  );
}
