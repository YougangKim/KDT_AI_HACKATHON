"use client";

import { useEffect, useRef, useState } from "react";
import type { UserLocation } from "@/lib/geo/distance";

export function LocationStep({
  onComplete,
  onSkip,
}: {
  onComplete: (location: UserLocation) => void;
  onSkip: () => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
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
  }, []);

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
  }, [point, radiusKm]);

  function useGps() {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 현재 위치를 사용할 수 없어요. 지도에서 직접 찍어 주세요.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPoint({ lat: coords.latitude, lng: coords.longitude }),
      () => setError("현재 위치를 가져오지 못했어요. 위치 권한을 확인하거나 지도에서 직접 찍어 주세요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4" aria-labelledby="location-title">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-indigo-500">시작하기 전에</p>
        <h1 id="location-title" className="text-2xl font-bold">내 위치와 원하는 거리를 알려 주세요</h1>
        <p className="text-xs text-slate-500">위치는 이 기기에만 저장되며 서버나 알림 조건으로 보내지지 않아요.</p>
      </div>

      <button type="button" onClick={useGps} className="min-h-11 rounded-xl bg-indigo-600 px-4 font-semibold text-white">
        📍 현재 위치 사용
      </button>

      <div ref={mapElement} data-testid="location-map" className="h-[280px] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200" />
      <p className="text-center text-sm text-slate-600">또는 지도에서 원하는 위치를 직접 눌러 주세요.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {point && (
        <div className="space-y-2" role="group" aria-label="거리 반경">
          <p className="text-sm font-semibold">얼마나 가까운 곳을 찾을까요?</p>
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
              상관없어요
            </button>
          </div>
          {radiusKm !== undefined && (
            <button type="button" onClick={() => onComplete({ ...point, radiusKm })} className="min-h-11 w-full rounded-xl bg-slate-900 font-semibold text-white">
              이 위치로 계속하기
            </button>
          )}
        </div>
      )}

      <button type="button" onClick={onSkip} className="min-h-11 text-sm font-medium text-slate-500 underline">건너뛰기</button>
    </section>
  );
}
