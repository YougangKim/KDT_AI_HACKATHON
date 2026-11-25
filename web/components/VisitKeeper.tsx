"use client";

import { useEffect } from "react";
import { touchVisit } from "@/lib/visit";
import { researchStatus } from "@/lib/alerts/client";
import { loadWatch } from "@/lib/alerts";

/** 앱을 열 때마다 방문 시각을 갱신한다. 알림 조건을 서버에 저장한 기기면 서버에도 접속을 알려 14일 보관 기간을 연장한다 */
export function VisitKeeper() {
  useEffect(() => {
    touchVisit();
    try {
      if (loadWatch() && localStorage.getItem("watchId")) void researchStatus();
    } catch {}
  }, []);
  return null;
}
