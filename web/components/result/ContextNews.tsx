"use client";
import { useState } from "react";
import type { Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";

export function ContextNews({ domain }: { domain: Domain }) {
  const [items, setItems] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [provider, setProvider] = useState<string | null>(null);
  async function search() {
    setStatus("loading");
    try {
      const response = await fetch(`/api/insights?domain=${domain}`);
      if (!response.ok) throw new Error("조회 실패");
      const result = await response.json();
      setItems(result.items ?? []);
      setProvider(result.provider);
      setStatus("done");
    } catch { setStatus("error"); }
  }
  return <section className="app-card space-y-3 p-4" aria-label="관심 분야 통계와 동향">
    <h2 className="font-bold">{DOMAIN_META[domain].label} · 통계와 동향</h2>
    <p className="text-xs text-slate-600">공식 기관의 통계·정책 자료를 검색합니다. 검색 순서는 인기 순위가 아닙니다.</p>
    <button disabled={status === "loading"} onClick={search} className="rounded-xl border px-4 py-3 disabled:opacity-50">{status === "loading" ? "조회 중…" : "관련 자료 조회"}</button>
    <div role="status">{status === "error" && "조회하지 못했습니다. 다시 시도할 수 있습니다."}{status === "done" && !items.length && "현재 검색 결과가 없습니다. 검색 제공자 연결 또는 조회 한도를 확인해야 합니다."}</div>
    {items.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border p-3"><h3 className="font-semibold">{item.title} ↗</h3><p className="mt-1 text-sm text-slate-600">{item.snippet}</p><span className="text-xs text-slate-500">{new URL(item.url).hostname} · {provider}</span></a>)}
  </section>;
}
