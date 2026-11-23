import { searchContext } from "@/lib/sources/websearch";
import type { Domain } from "@/lib/types";

const DOMAINS = new Set(["housing", "job", "parttime", "benefit", "training", "exam"]);
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain") ?? "";
  if (!DOMAINS.has(domain)) return Response.json({ error: "지원하지 않는 분야입니다." }, { status: 400 });
  const result = await searchContext(domain as Domain);
  return Response.json(result, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
