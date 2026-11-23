"use client";

import { useRef, useState, type ReactNode } from "react";

/** 목록을 누적해서 펼치지 않고 5개씩 교체합니다. */
export function PaginatedList({ children, label, ordered = false, className = "space-y-2" }: {
  children: ReactNode[]; label: string; ordered?: boolean; className?: string;
}) {
  const [page, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(children.length / 5));
  const current = Math.min(page, pages - 1);
  const List = ordered ? "ol" : "ul";
  function move(next: number) {
    setPage(next);
    root.current?.scrollIntoView({ block: "start" });
    root.current?.focus({ preventScroll: true });
  }
  return <div ref={root} tabIndex={-1} className="space-y-3 scroll-mt-4">
    <List aria-label={label} className={className} {...(ordered ? { start: current * 5 + 1 } : {})}>
      {children.slice(current * 5, (current + 1) * 5)}
    </List>
    {pages > 1 && <nav aria-label={`${label} 페이지`} className="flex items-center justify-between gap-2 text-sm">
      <button type="button" disabled={current === 0} onClick={() => move(current - 1)} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">이전</button>
      <span role="status">{current + 1} / {pages} · 총 {children.length}개</span>
      <button type="button" disabled={current + 1 === pages} onClick={() => move(current + 1)} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">다음</button>
    </nav>}
  </div>;
}
