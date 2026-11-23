// 사용자가 입력한 주소·장소 한 건을 좌표로 바꾼다(위치 단계의 "주소 검색").
// 카카오 REST 키가 있으면 카카오(주소 → 키워드), 없으면 OpenStreetMap Nominatim(사용 정책: 사용자 1건 검색, 초당 1회 이하, 식별 가능한 User-Agent).
// 입력한 주소는 저장하지 않는다.
export const runtime = "nodejs";

let lastNominatim = 0;

async function kakao(q: string, key: string): Promise<{ lat: number; lng: number; label: string } | null> {
  for (const kind of ["address", "keyword"] as const) {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/${kind}.json?query=${encodeURIComponent(q)}&size=1`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) continue;
    const d = (await res.json()) as { documents?: { x: string; y: string; address_name?: string; place_name?: string }[] };
    const doc = d.documents?.[0];
    if (doc) return { lat: Number(doc.y), lng: Number(doc.x), label: doc.place_name || doc.address_name || q };
  }
  return null;
}

async function nominatim(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": "MyNews-hackathon-demo/1.0", "Accept-Language": "ko" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon), label: d[0].display_name } : null;
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: "검색어가 너무 짧습니다" }, { status: 400 });
  try {
    const key = process.env.KAKAO_REST_API_KEY;
    const hit = (key ? await kakao(q, key) : null) ?? (await nominatim(q));
    return hit ? Response.json(hit) : Response.json({ error: "주소를 찾지 못했습니다" }, { status: 404 });
  } catch {
    return Response.json({ error: "주소 검색 실패" }, { status: 502 });
  }
}
