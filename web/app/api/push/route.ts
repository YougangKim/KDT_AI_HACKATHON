import * as webpush from "web-push";

export const runtime = "nodejs";

function keys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** 클라이언트가 구독에 쓸 공개키. 키가 없으면 null → 로컬 알림 데모로 폴백 */
export async function GET() {
  return Response.json({ publicKey: keys()?.publicKey ?? null });
}

// 남용 방지: 알려진 브라우저 푸시 서비스만, 문구는 서버 고정, IP당 1분 3회
import { PUSH_HOSTS } from "@/lib/server/security";
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 3;
}

/** 받은 구독으로 고정 문구의 테스트 푸시 발송(구독은 저장하지 않음) */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 429 });
  const k = keys();
  if (!k) return Response.json({ error: "VAPID 키가 설정되지 않았어요" }, { status: 503 });

  let body: { subscription?: webpush.PushSubscription };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "구독 정보가 없어요" }, { status: 400 });
  }
  let host = "";
  try {
    host = new URL(sub.endpoint).hostname;
  } catch {}
  if (!PUSH_HOSTS.some((re) => re.test(host))) {
    return Response.json({ error: "지원하지 않는 푸시 서비스" }, { status: 400 });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:demo@example.com", k.publicKey, k.privateKey);
  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({
        title: "My News",
        body: "조건에 맞는 새 공고가 도착했어요. 눌러서 확인해 보세요.",
        url: "/alerts",
      }),
    );
    return Response.json({ ok: true });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 500;
    return Response.json({ error: "발송 실패", status }, { status: 502 });
  }
}
