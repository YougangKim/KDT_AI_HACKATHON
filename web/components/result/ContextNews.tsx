"use client";
import { useState } from "react";
import type { Domain } from "@/lib/types";
import { DOMAIN_META } from "./domain";

export function ContextNews({ domains, keywords = "" }: { domains: Domain[]; keywords?: string }) {
  const [items, setItems] = useState<{ title: string; url: string; snippet: string; date?: string }[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  async function search() {
    setStatus("loading");
    try {
      const response = await fetch(`/api/insights?domain=${domains.join(",")}&q=${encodeURIComponent(keywords)}`);
      if (!response.ok) throw new Error("조회 실패");
      const result = await response.json();
      setItems(result.items ?? []);
      setStatus("done");
    } catch { setStatus("error"); }
  }
  return <section className="app-card space-y-3 p-4" aria-label="관련 뉴스">
    <h2 className="font-bold">{domains.map((d) => DOMAIN_META[d].label).join("·")} · 관련 뉴스</h2>
    <p className="text-xs text-slate-600">인터뷰 답({keywords || "선택한 분야"})을 반영해 주요 언론사의 최근 3개월 기사를 최신순으로 찾습니다. 제목을 누르면 기사 원문으로 이동합니다.</p>
    <button disabled={status === "loading"} onClick={search} className="rounded-xl border px-4 py-3 disabled:opacity-50">{status === "loading" ? "조회 중…" : "관련 뉴스 보기"}</button>
    <div role="status">{status === "error" && "조회하지 못했습니다. 다시 시도할 수 있습니다."}{status === "done" && !items.length && "현재 검색 결과가 없습니다. 검색 제공자 연결 또는 조회 한도를 확인해야 합니다."}</div>
    {items.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border p-3"><h3 className="font-semibold">{item.title} ↗</h3><span className="text-xs text-slate-500">{new URL(item.url).hostname.replace(/^www\./, "")}{item.date ? ` · ${item.date}` : ""}</span></a>)}
  </section>;
}
