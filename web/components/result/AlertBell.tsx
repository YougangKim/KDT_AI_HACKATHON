"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { unreadCount } from "@/lib/alerts";
import { ALERTS_EVENT, checkAlerts, registerSW } from "@/lib/alerts/client";
import { Icon } from "@/components/brand/Icons";

/** 앱을 열 때 새 공고·마감 임박을 확인하고, 안 읽은 알림 수를 배지로 보여 준다.
 *  layout에 한 번 두면 모든 화면에서 동작합니다. */
export function AlertBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(unreadCount());
    refresh();
    window.addEventListener(ALERTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    registerSW().then(() => checkAlerts()).then(refresh);
    return () => {
      window.removeEventListener(ALERTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Link href="/alerts" className="relative inline-grid h-10 w-10 place-items-center rounded-xl text-slate-600" aria-label={`알림 ${count}개`}>
      <Icon name="bell" className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-0 top-0 min-w-5 rounded-full bg-rose-600 px-1 text-center text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
