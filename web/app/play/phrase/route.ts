// 질문 문장 다듬기(서버에서만 Claude 호출). 키가 없으면 ai=false → 화면은 기본 문장을 쓴다.
// 외부로 보내는 것은 질문 조건(범주값)뿐이다.
import { aiEnabled, phraseQuestion } from "@/lib/ai";
import type { Question } from "@/lib/types";

export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ ai: false });
  try {
    const { attr, op, value } = (await req.json()) as Pick<Question, "attr" | "op" | "value">;
    return Response.json({ ai: true, text: await phraseQuestion({ attr, op, value }) });
  } catch {
    return Response.json({ ai: false });
  }
}
