interface LatLng { getLat(): number; getLng(): number }
interface Bounds { extend(point: LatLng): void }
interface MapInstance { setBounds(bounds: Bounds): void; setCenter(point: LatLng): void; setLevel(level: number): void; getLevel(): number; relayout(): void }
interface Layer { setMap(map: MapInstance | null): void }
export interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => Bounds;
  Map: new (element: HTMLElement, options: { center: LatLng; level: number }) => MapInstance;
  CustomOverlay: new (options: Record<string, unknown>) => Layer;
  Circle: new (options: Record<string, unknown>) => Layer;
  event: { addListener(target: MapInstance, type: string, callback: (event: { latLng: LatLng }) => void): void; removeListener(target: MapInstance, type: string, callback: (event: { latLng: LatLng }) => void): void };
}
let loading: Promise<KakaoMaps> | undefined;
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (loading) return loading;
  loading = fetch("/api/map-config", { cache: "no-store", signal: AbortSignal.timeout(10000) }).then(async (response) => {
    if (!response.ok) throw new Error("Kakao 지도 설정 조회 실패");
    const { key } = await response.json() as { key: string | null };
    if (!key) throw new Error("Kakao JavaScript 키 미설정");
    return new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => reject(new Error("Kakao 지도 로딩 시간 초과")), 25000);
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onerror = () => { clearTimeout(timer); reject(new Error("Kakao 지도 SDK 로딩 실패")); };
    script.onload = () => {
      const api = (window as unknown as { kakao?: { maps: KakaoMaps } }).kakao?.maps;
      if (!api) { clearTimeout(timer); reject(new Error("Kakao 지도 키·도메인 확인 필요")); return; }
      api.load(() => { clearTimeout(timer); resolve(api); });
    };
    document.head.append(script);
    });
  });
  // 실패(느린 모바일 망 등)하면 다음 화면에서 다시 시도할 수 있게 캐시를 비운다
  loading.catch(() => { loading = undefined; });
  return loading;
}
