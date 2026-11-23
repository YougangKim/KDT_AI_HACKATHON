// 질문 문장 다듬기(서버에서만 Claude 호출). 키가 없으면 ai=false → 화면은 기본 문장을 쓴다.
// 외부로 보내는 것은 질문 조건(범주값)뿐입니다.
import { aiEnabled, phraseQuestion } from "@/lib/ai";
import { cachedResult, cacheKey, stableJson } from "@/lib/ai/cache";
import type { Question } from "@/lib/types";

const PHRASE_PROMPT_VERSION = "phrase-v1";

export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ ai: false });
  try {
    const { attr, op, value } = (await req.json()) as Pick<Question, "attr" | "op" | "value">;
    const input = { attr, op, value };
    const key = `${cacheKey(PHRASE_PROMPT_VERSION)}\n${stableJson(input)}`;
    const text = await cachedResult(
      "phrase",
      key,
      1,
      () => phraseQuestion(input),
      (result) => typeof result === "string" && result.trim().length > 0,
    );
    return Response.json({ ai: true, text });
  } catch {
    return Response.json({ ai: false });
  }
}
