"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { KakaoMap } from "@/components/KakaoMap";
import type { Match } from "@/lib/types";
import type { UserLocation } from "@/lib/geo/distance";
import { DOMAIN_META } from "./domain";
import { Icon, iconSvg } from "@/components/brand/Icons";

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
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const useKakao = !kakaoFailed;
  const fallback = useCallback(() => setKakaoFailed(true), []);

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
    if (useKakao || !element.current) return;
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
          interactive: false,
          keyboard: false,
          zIndexOffset: -1000,
          icon: L.divIcon({ className: "", html: '<span class="map-pin">나</span>', iconSize: [26, 26] }),
        }).addTo(map).bindPopup("내 위치");
        if (typeof location.radiusKm === "number") {
          L.circle([location.lat, location.lng], {
            radius: location.radiusKm * 1000,
            color: "#4f46e5",
            fillOpacity: 0.06,
          }).addTo(map);
        }
      }

      const popup = (match: Match, accuracy: string) => {
        const o = match.opportunity;
        const root = document.createElement("div");
        root.className = "space-y-1";
        const title = document.createElement("strong");
        title.textContent = o.title;
        const org = document.createElement("div");
        org.textContent = o.org;
        const address = document.createElement("div");
        address.textContent = o.place ?? o.geo?.address ?? o.region.join("·") ?? "주소 미상";
        const precision = document.createElement("div");
        precision.textContent = accuracy;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "카드 보기";
        button.className = "mt-1 rounded bg-indigo-600 px-2 py-1 font-semibold text-white";
        button.addEventListener("click", () => onSelect(o.id));
        root.append(title, org, address, precision, button);
        return root;
      };

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
        const meta = DOMAIN_META[match.opportunity.domain];
        const opacity = geo.precision === "exact" ? 1 : 0.62;
        const marker = L.marker([geo.lat, geo.lng], {
          opacity,
          icon: L.divIcon({
            className: "",
            html: `<span class="map-pin" data-domain="${match.opportunity.domain}" title="${meta.label}" style="background:${meta.color}">${iconSvg(meta.icon)}</span>`,
            iconSize: [26, 26],
          }),
        }).addTo(map).bindPopup(popup(match, geo.precision === "exact" ? "정확한 주소" : "기관·단지 위치 추정"));
        marker.on("click", () => onSelect(id));
        markers.current.set(id, marker);
        bounds.push([geo.lat, geo.lng]);
      }
      for (const [key, group] of regional) {
        const [lat, lng] = key.split(",").map(Number);
        const domains = [...new Set(group.map((match) => match.opportunity.domain))];
        const meta = domains.length === 1 ? DOMAIN_META[domains[0]] : null;
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html: `<span class="map-pin" style="background:${meta?.color ?? "#64748b"}">${meta ? iconSvg(meta.icon) : group.length}</span>`,
            iconSize: [26, 26],
          }),
        }).addTo(map);
        if (group.length === 1) {
          marker.bindPopup(popup(group[0], "시·도 단위"));
          marker.on("click", () => onSelect(group[0].opportunity.id));
          markers.current.set(group[0].opportunity.id, marker);
        } else {
          const list = document.createElement("div");
          list.style.maxHeight = "200px";
          list.style.overflowY = "auto";
          for (const match of group) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "block w-full border-b py-3 text-left";
            button.textContent = match.opportunity.title;
            button.addEventListener("click", () => onSelect(match.opportunity.id));
            list.append(button);
          }
          marker.bindPopup(list);
        }
        bounds.push([lat, lng]);
      }
      if (location) bounds.push([location.lat, location.lng]);
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 11 });
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pins.clear();
    };
  }, [matches, location, onSelect, useKakao]);

  return (
    <section aria-label="결과 지도" className="app-card space-y-3 overflow-hidden p-3">
      {useKakao ? <KakaoMap matches={matches} point={location} radiusKm={location?.radiusKm} onSelect={onSelect} onError={fallback} testId="result-map" /> : <div ref={element} data-testid="result-map" data-map-provider="openstreetmap" className="h-[280px] w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />}
      {kakaoFailed && <p className="text-xs text-amber-800">Kakao 지도 연결 실패로 대체 지도를 표시합니다.</p>}
      <p className="text-xs text-slate-500">
        진한 핀은 주소, 연한 핀은 추정 위치입니다. 묶인 핀에서 공고를 선택할 수 있습니다.
      </p>
      <ul aria-label="지도 분야 범례" className="flex flex-wrap gap-2 text-xs text-slate-600">
        {Object.entries(DOMAIN_META).filter(([domain]) => matches.some((match) => match.opportunity.domain === domain)).map(([domain, meta]) => (
          <li key={domain} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <span className="grid h-5 w-5 place-items-center rounded-md text-white" style={{ backgroundColor: meta.color }} aria-hidden>
              <Icon name={meta.icon} className="h-3.5 w-3.5" />
            </span>
            {meta.label}
          </li>
        ))}
      </ul>
    </section>
  );
});
