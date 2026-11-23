"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KakaoMap } from "@/components/KakaoMap";
import type { UserLocation } from "@/lib/geo/distance";
import { Icon } from "@/components/brand/Icons";

export function LocationStep({
  onComplete,
  onSkip,
  initial,
  settings = false,
}: {
  onComplete: (location: UserLocation) => void;
  onSkip: () => void;
  initial?: UserLocation;
  settings?: boolean;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null | undefined>(initial?.radiusKm);
  const [error, setError] = useState("");
  const [found, setFound] = useState(""); // 주소 검색으로 찾은 장소 이름(카카오 결과)
  const [kakaoFailed, setKakaoFailed] = useState<string | false>(false);
  const useKakao = !kakaoFailed;
  const fallback = useCallback((reason?: string) => setKakaoFailed(reason || "알 수 없는 오류"), []);

  useEffect(() => {
    if (useKakao || !mapElement.current || mapRef.current) return;
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !mapElement.current) return;
      const map = L.map(mapElement.current).setView([36.4, 127.8], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
        setError("");
      });
      mapRef.current = map;
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [useKakao]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    void import("leaflet").then((L) => {
      markerRef.current?.remove();
      markerRef.current = L.marker(point, {
        icon: L.divIcon({ className: "", html: '<span class="map-pin">나</span>', iconSize: [26, 26] }),
      }).addTo(map);
      circleRef.current?.remove();
      if (radiusKm !== undefined && radiusKm !== null) {
        circleRef.current = L.circle(point, {
          radius: radiusKm * 1000,
          color: "#4f46e5",
          fillOpacity: 0.08,
        }).addTo(map);
      }
      map.setView(point, 13);
    });
  }, [point, radiusKm, useKakao]);

  // 주소 검색: 서버 /api/geocode(카카오 키가 있으면 카카오, 없으면 오픈스트리트맵 Nominatim)
  async function searchAddress() {
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const d = (await res.json()) as { lat?: number; lng?: number; label?: string };
      if (typeof d.lat === "number" && typeof d.lng === "number") {
        setPoint({ lat: d.lat, lng: d.lng });
        setFound(d.label || query.trim());
      } else setError("주소를 찾지 못했습니다. 시·구·동을 입력하거나 지도에서 위치를 선택할 수 있습니다.");
    } catch {
      setError("주소 검색에 실패했습니다. 지도에서 위치를 선택할 수 있습니다.");
    } finally {
      setSearching(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 현재 위치를 사용할 수 없습니다. 지도에서 위치를 선택할 수 있습니다.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPoint({ lat: coords.latitude, lng: coords.longitude }),
      () => setError("현재 위치를 가져오지 못했습니다. 위치 권한을 확인하거나 지도에서 위치를 선택할 수 있습니다."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4" aria-labelledby="location-title">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-indigo-500">{settings ? "알림 위치" : "시작하기 전에"}</p>
        <h1 id="location-title" className={settings ? "text-lg font-bold" : "text-2xl font-bold"}>탐색 위치와 거리 설정</h1>
        <p className="text-xs text-slate-500">{settings ? "알림용으로 대략적인 위치(약 1km 단위)가 서버에 저장됩니다." : "결과 탐색 위치는 이 기기에 저장됩니다."}</p>
      </div>

      <button type="button" onClick={useGps} className="min-h-11 rounded-xl bg-indigo-600 px-4 font-semibold text-white">
        <Icon name="pin" className="mr-1 inline h-5 w-5 align-[-4px]" />현재 위치 사용
      </button>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void searchAddress();
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="주소나 장소 검색 (예: 서울시청, 강남구 역삼동)"
          aria-label="주소 검색"
          className="min-h-11 flex-1 rounded-xl px-3 text-sm ring-1 ring-slate-300"
        />
        <button type="submit" disabled={searching || !query.trim()} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40">
          {searching ? "찾는 중" : "검색"}
        </button>
      </form>

      {useKakao ? <KakaoMap point={point} radiusKm={radiusKm} onPoint={setPoint} onError={fallback} testId="location-map" /> : <div ref={mapElement} data-testid="location-map" data-map-provider="openstreetmap" className="h-[280px] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200" />}
      {kakaoFailed && <p className="text-xs text-amber-800">Kakao 지도를 불러오지 못해 대체 지도를 표시합니다({kakaoFailed}). <button type="button" className="underline" onClick={() => setKakaoFailed(false)}>다시 시도</button></p>}
      <p className="text-center text-sm text-slate-600">지도에서도 원하는 위치를 선택할 수 있습니다.</p>
      {found && !error && <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800 break-keep">검색 위치: {found}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {point && (
        <div className="space-y-2" role="group" aria-label="거리 반경">
          <p className="text-sm font-semibold">희망 탐색 거리</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 5, 10].map((radius) => (
              <button
                key={radius}
                type="button"
                onClick={() => setRadiusKm(radius)}
                aria-pressed={radiusKm === radius}
                className={`min-h-11 rounded-xl font-semibold ${radiusKm === radius ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-200"}`}
              >
                {radius}km
              </button>
            ))}
            <button type="button" onClick={() => setRadiusKm(null)} aria-pressed={radiusKm === null} className={`min-h-11 rounded-xl px-2 font-semibold ${radiusKm === null ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>
              거리 제한 없음
            </button>
          </div>
          {radiusKm !== undefined && (
            <button type="button" onClick={() => onComplete({ ...point, radiusKm })} className="min-h-11 w-full rounded-xl bg-slate-900 font-semibold text-white">
              {settings ? "이 위치 사용하기" : "이 위치로 계속하기"}
            </button>
          )}
        </div>
      )}

      <button type="button" onClick={onSkip} className="min-h-11 text-sm font-medium text-slate-500 underline">{settings ? "위치 지우기" : "건너뛰기"}</button>
    </section>
  );
}
