export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JavaScript 지도 키는 SDK 로딩에 필요한 공개 식별자다. REST 키는 반환하지 않는다. */
export async function GET() {
  const key = process.env.KAKAO_MAP_KEY?.trim() || process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim();
  const valid = !!key && key !== process.env.KAKAO_REST_API_KEY?.trim();
  return Response.json({ key: valid ? key : null }, { headers: { "Cache-Control": "no-store" } });
}
