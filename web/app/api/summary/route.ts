import { aiEnabled, auxAiEnabled } from "@/lib/ai";
import { cachedSummaries, summarizeOpportunities } from "@/lib/ai/summary";
import { loadOpportunities } from "@/lib/sources";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids) || body.ids.length > 5 || body.ids.some((id) => typeof id !== "string")) {
      return Response.json({ ai: false }, { status: 400 });
    }
    const ids = [...new Set(body.ids as string[])];
    if (!ids.length || !aiEnabled()) return Response.json({ ai: false });

    const cached = cachedSummaries(ids);
    const cachedIds = new Set(cached.map((item) => item.id));
    const missingIds = ids.filter((id) => !cachedIds.has(id));
    if (!missingIds.length) return Response.json({ ai: true, items: cached });
    // 부가 작업: 새 AI 요약은 AI_AUX=1일 때만. 기본은 카드가 공고 원본 요약·신청방법을 그대로 보여 준다
    if (!auxAiEnabled()) return Response.json(cached.length ? { ai: true, items: cached } : { ai: false });

    // 직전 공고 조회에서 채운 어댑터 캐시를 재사용하므로 원격 조회를 최소화합니다.
    const opportunities = await loadOpportunities();
    const wanted = new Set(missingIds);
    const items = opportunities.filter((item) => wanted.has(item.id));
    if (!items.length) return Response.json(cached.length ? { ai: true, items: cached } : { ai: false });

    const generated = await Promise.race([
      summarizeOpportunities(items),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const result = generated ? [...cached, ...generated] : cached;
    return Response.json(result.length ? { ai: true, items: result } : { ai: false });
  } catch {
    return Response.json({ ai: false });
  }
}
