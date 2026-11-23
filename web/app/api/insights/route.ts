import { searchContext } from "@/lib/sources/websearch";
import type { Domain } from "@/lib/types";

const DOMAINS = new Set(["housing", "job", "parttime", "benefit", "training", "exam"]);
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const domains = (params.get("domain") ?? "").split(",").filter(Boolean);
  if (!domains.length || domains.length > 6 || !domains.every((d) => DOMAINS.has(d))) return Response.json({ error: "지원하지 않는 분야입니다." }, { status: 400 });
  // 인터뷰 답(지역·상태 등)에서 나온 짧은 검색어만 허용
  const keywords = (params.get("q") ?? "").replace(/[^\p{L}\p{N}\s·]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const result = await searchContext(domains as Domain[], keywords);
  return Response.json(result, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
