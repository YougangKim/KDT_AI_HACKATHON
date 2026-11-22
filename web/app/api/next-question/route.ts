// 다음 질문 고르기(AI). 키가 없거나 실패·지연(4초)이면 ai=false → 화면은 규칙 1순위를 쓴다.
import { aiEnabled, pickNextQuestion, type QuestionCandidate } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ ai: false });
  try {
    const { candidates, answered, total } = (await req.json()) as { candidates: QuestionCandidate[]; answered: { text: string; answer: string }[]; total: number };
    if (!Array.isArray(candidates) || candidates.length > 8) return Response.json({ ai: false });
    const id = await Promise.race([pickNextQuestion(candidates, answered ?? [], Number(total) || 0), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    return Response.json(id ? { ai: true, id } : { ai: false });
  } catch {
    return Response.json({ ai: false });
  }
}
