import { NextResponse } from "next/server";
import { loadOpportunities, parseDomains } from "@/lib/sources";
import { forClient } from "@/lib/sources/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/opportunities?domains=housing,benefit → Opportunity[]
export async function GET(req: Request) {
  const domains = parseDomains(new URL(req.url).searchParams.get("domains"));
  // 자격요건 원문(eligibility)은 서버에서만 쓰고 화면에는 보내지 않는다
  const items = (await loadOpportunities(domains)).map(forClient);
  return NextResponse.json(items, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
