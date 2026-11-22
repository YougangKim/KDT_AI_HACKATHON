"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Match } from "@/lib/types";
import type { UserLocation } from "@/lib/geo/distance";

export interface ResultMapHandle {
  show: (id: string) => void;
}

export const ResultMap = forwardRef<ResultMapHandle, {
  matches: Match[];
  location?: UserLocation;
  onSelect: (id: string) => void;
}>(function ResultMap({ matches, location, onSelect }, ref) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markers = useRef(new Map<string, import("leaflet").Marker>());

  useImperativeHandle(ref, () => ({
    show(id) {
      const marker = markers.current.get(id);
      if (!marker || !mapRef.current) return;
      mapRef.current.flyTo(marker.getLatLng(), 14);
      marker.openPopup();
    },
  }), []);

  useEffect(() => {
    const pins = markers.current;
    if (!element.current) return;
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      const map = L.map(element.current).setView(
        location ? [location.lat, location.lng] : [36.4, 127.8],
        location ? 12 : 6,
      );
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (location) {
        L.marker([location.lat, location.lng], {
          icon: L.divIcon({ className: "", html: '<span class="map-pin">나</span>', iconSize: [26, 26] }),
        }).addTo(map).bindPopup("내 위치");
        if (location.radiusKm !== null) {
          L.circle([location.lat, location.lng], {
            radius: location.radiusKm * 1000,
            color: "#4f46e5",
            fillOpacity: 0.06,
          }).addTo(map);
        }
      }

      const bounds: import("leaflet").LatLngExpression[] = [];
      const regional = new Map<string, Match[]>();
      for (const match of matches) {
        const geo = match.opportunity.geo;
        if (!geo) continue;
        if (geo.precision === "region") {
          const key = `${geo.lat},${geo.lng}`;
          regional.set(key, [...(regional.get(key) ?? []), match]);
          continue;
        }
        const id = match.opportunity.id;
        const opacity = geo.precision === "exact" ? 1 : 0.62;
        const marker = L.marker([geo.lat, geo.lng], {
          opacity,
          icon: L.divIcon({ className: "", html: `<span class="map-pin">${geo.precision === "exact" ? "●" : "○"}</span>`, iconSize: [26, 26] }),
        }).addTo(map).bindPopup(match.opportunity.title);
        marker.on("click", () => onSelect(id));
        markers.current.set(id, marker);
        bounds.push([geo.lat, geo.lng]);
      }
      for (const [key, group] of regional) {
        const [lat, lng] = key.split(",").map(Number);
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<span class="map-pin">${group.length}</span>`, iconSize: [26, 26] }),
        }).addTo(map).bindPopup(`지역 단위 공고 ${group.length}건`);
        bounds.push([lat, lng]);
      }
      if (bounds.length && !location) map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 11 });
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pins.clear();
    };
  }, [matches, location, onSelect]);

  return (
    <section aria-label="결과 지도" className="space-y-2">
      <div ref={element} data-testid="result-map" className="h-[280px] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200" />
      <p className="text-xs text-slate-500">
        진한 핀은 정확한 위치, 연한 핀은 근사 위치예요. 지역 단위 공고는 묶어서 표시해요.
      </p>
    </section>
  );
});
