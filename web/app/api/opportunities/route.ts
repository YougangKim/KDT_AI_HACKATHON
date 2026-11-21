import { NextResponse } from "next/server";
import { loadOpportunities, parseDomains } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/opportunities?domains=housing,benefit → Opportunity[]
export async function GET(req: Request) {
  const domains = parseDomains(new URL(req.url).searchParams.get("domains"));
  const items = await loadOpportunities(domains);
  return NextResponse.json(items, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
