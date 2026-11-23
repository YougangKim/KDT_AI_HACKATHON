"use client";
import { useEffect, useRef } from "react";
import { loadKakaoMaps } from "@/lib/geo/kakao-sdk";
import type { Match } from "@/lib/types";
import { DOMAIN_META } from "./result/domain";

const EMPTY: Match[] = [];
export function KakaoMap({ matches = EMPTY, point, radiusKm, onSelect, onPoint, onError, testId }: {
  matches?: Match[];
  point?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  onSelect?: (id: string) => void;
  onPoint?: (point: { lat: number; lng: number }) => void;
  onError: () => void;
  testId: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void loadKakaoMaps().then((api) => {
      if (disposed || !element.current) return;
      const map = new api.Map(element.current, { center: new api.LatLng(point?.lat ?? 36.4, point?.lng ?? 127.8), level: point ? 6 : 13 });
      const layers: { setMap(map: null): void }[] = [];
      const bounds = new api.LatLngBounds();
      let points = 0;
      if (point) {
        const position = new api.LatLng(point.lat, point.lng);
        bounds.extend(position); points++;
        const content = document.createElement("span");
        content.textContent = "나"; content.className = "map-pin"; content.style.pointerEvents = "none";
        layers.push(new api.CustomOverlay({ map, position, content, zIndex: 0 }));
        if (radiusKm != null) layers.push(new api.Circle({ map, center: position, radius: radiusKm * 1000, strokeColor: "#4f46e5", strokeWeight: 2, fillColor: "#4f46e5", fillOpacity: 0.08 }));
      }
      const groups = new Map<string, Match[]>();
      for (const match of matches) {
        const geo = match.opportunity.geo;
        if (geo) { const key = `${geo.lat},${geo.lng}`; groups.set(key, [...(groups.get(key) ?? []), match]); }
      }
      for (const group of groups.values()) {
        const geo = group[0].opportunity.geo!;
        const position = new api.LatLng(geo.lat, geo.lng);
        if (!point && points === 0) map.setCenter(position);
        bounds.extend(position); points++;
        const content = document.createElement("div");
        const pin = document.createElement("button");
        pin.type = "button"; pin.className = "map-pin";
        pin.textContent = group.length > 1 ? String(group.length) : DOMAIN_META[group[0].opportunity.domain].label.slice(0, 2);
        pin.setAttribute("aria-label", group.length > 1 ? `이 위치의 공고 ${group.length}건` : group[0].opportunity.title);
        pin.style.background = DOMAIN_META[group[0].opportunity.domain].color;
        content.append(pin);
        if (group.length === 1) pin.onclick = () => onSelect?.(group[0].opportunity.id);
        else {
          const list = document.createElement("div");
          list.className = "hidden max-h-48 w-60 overflow-auto rounded-xl bg-white p-2 shadow-lg";
          pin.onclick = () => list.classList.toggle("hidden");
          for (const match of group) {
            const button = document.createElement("button");
            button.type = "button"; button.className = "block w-full whitespace-normal border-b py-3 text-left text-sm";
            button.textContent = match.opportunity.title;
            button.onclick = () => onSelect?.(match.opportunity.id);
            list.append(button);
          }
          content.append(list);
        }
        layers.push(new api.CustomOverlay({ map, position, content, zIndex: 10, yAnchor: 1 }));
      }
      if (points > 1) map.setBounds(bounds);
      const click = (event: { latLng: { getLat(): number; getLng(): number } }) => onPoint?.({ lat: event.latLng.getLat(), lng: event.latLng.getLng() });
      if (onPoint) api.event.addListener(map, "click", click);
      const resize = new ResizeObserver(() => map.relayout());
      resize.observe(element.current);
      cleanup = () => { resize.disconnect(); layers.forEach((layer) => layer.setMap(null)); if (onPoint) api.event.removeListener(map, "click", click); };
    }).catch(() => { if (!disposed) onError(); });
    return () => { disposed = true; cleanup(); };
  }, [matches, point, radiusKm, onSelect, onPoint, onError]);
  return <div ref={element} data-testid={testId} data-map-provider="kakao" className="h-[280px] w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />;
}
