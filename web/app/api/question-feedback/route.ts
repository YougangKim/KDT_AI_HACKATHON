import {
  allowQuestionFeedbackShared,
  recordQuestionFeedback,
  type FeedbackType,
} from "@/lib/server/question-feedback";

export const runtime = "nodejs";
const TYPES = new Set<FeedbackType>(["shown", "answered", "unknown", "skipped", "undo"]);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  if (!(await allowQuestionFeedbackShared(ip))) {
    return Response.json({ ok: false }, { status: 429 });
  }
  try {
    const body = await req.json() as Record<string, unknown>;
    if (
      typeof body.key !== "string" ||
      !/^[0-9a-f]{24}$/.test(body.key) ||
      !TYPES.has(body.type as FeedbackType) ||
      !Number.isFinite(body.before) ||
      !Number.isFinite(body.after)
    ) {
      return Response.json({ ok: false }, { status: 400 });
    }
    await recordQuestionFeedback({
      key: body.key,
      type: body.type as FeedbackType,
      before: Math.max(0, Number(body.before)),
      after: Math.max(0, Number(body.after)),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
