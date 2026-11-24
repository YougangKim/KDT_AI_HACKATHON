// 사용자 피드백 설문 저장. IP·기기 정보는 저장하지 않는다(남용 방지용 IP는 메모리에서 1분만 사용).
import { persistent, redis } from "@/lib/server/store";
import { parseFeedback, summarize, type Feedback } from "@/lib/feedback";

export const runtime = "nodejs";

const KEY = "feedback:list";
const MAX = 5000;
const memory: string[] = [];
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 3;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const fb = parseFeedback(body);
  if (!fb) return Response.json({ error: "필수 문항이 비어 있습니다" }, { status: 400 });
  const row = JSON.stringify({ ...fb, at: new Date().toISOString() });
  try {
    if (persistent()) {
      await redis(["LPUSH", KEY, row]);
      await redis(["LTRIM", KEY, 0, MAX - 1]);
    } else {
      memory.unshift(row);
      memory.length = Math.min(memory.length, MAX);
    }
  } catch {
    return Response.json({ error: "저장에 실패했습니다" }, { status: 502 });
  }
  return Response.json({ ok: true });
}

/** 관리자 조회: Authorization: Bearer <FEEDBACK_ADMIN_KEY 또는 CRON_SECRET>. ?format=csv 로 내려받기 */
export async function GET(req: Request) {
  const secret = process.env.FEEDBACK_ADMIN_KEY ?? process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? url.searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "권한이 없습니다" }, { status: 401 });
  const raw = persistent() ? (((await redis(["LRANGE", KEY, 0, MAX - 1])) as string[]) ?? []) : memory;
  const rows = raw.map((r) => JSON.parse(r) as Feedback & { at: string });
  if (url.searchParams.get("format") === "csv") {
    const cols = ["at", "ease", "fit", "reuse", "screen", "comment", "path", "ref"] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join(String.fromCharCode(10));
    return new Response(String.fromCharCode(0xfeff) + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=feedback.csv" } });
  }
  return Response.json({ persistent: persistent(), summary: summarize(rows), items: rows.slice(0, 200) });
}
