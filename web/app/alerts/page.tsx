"use client";
import { checkAlerts } from "@/lib/alerts/client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Watch } from "@/lib/types";
import { clearWatch, loadAlertLog, loadWatch, markAllRead, type AlertItem } from "@/lib/alerts";
import {
  ALERTS_EVENT,
  notificationsSupported,
  pushPublicKey,
  requestPermission,
  researchStatus,
  sendTestPush,
  syncWatch,
  deleteServerWatch,
  type ResearchStatus,
} from "@/lib/alerts/client";
import { DOMAIN_META } from "@/components/result/domain";
import { WeeklyReport } from "@/components/result/WeeklyReport";
import { PaginatedList } from "@/components/PaginatedList";

const ANSWER_LABEL = { yes: "예", no: "아니오", unknown: "모름" } as const;
const TABS = ["받은 알림", "리서치 현황", "저장 조건", "설정"] as const;

export default function AlertsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("받은 알림");
  const [alertId, setAlertId] = useState<string | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const [log, setLog] = useState<AlertItem[]>([]);
  const [perm, setPerm] = useState<string>("");
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [rs, setRs] = useState<ResearchStatus | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setAlertId(new URLSearchParams(window.location.search).get("alert"));
    const refresh = () => {
      setWatch(loadWatch());
      setLog(loadAlertLog());
    };
    refresh();
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
    pushPublicKey().then(setPushKey);
    if (loadWatch()) researchStatus().then(setRs);
    window.addEventListener(ALERTS_EVENT, refresh);
    // 화면을 떠날 때 읽음 처리(들어올 때는 안 읽은 표시를 보여 준다)
    return () => {
      window.removeEventListener(ALERTS_EVENT, refresh);
      markAllRead();
    };
  }, []);

  async function onPermission() {
    setPerm(await requestPermission());
  }

  async function onCheck() {
    const items = await checkAlerts();
    setLog(loadAlertLog());
    setNote(items.length ? "새 알림을 확인했습니다." : "이번 조회에서 새로 알릴 공고가 없습니다.");
  }

  async function onPush() {
    if (!pushKey) return;
    setNote((await sendTestPush(pushKey)) ? "푸시를 발송했습니다. 잠시 후 도착합니다." : "푸시 발송에 실패했습니다.");
  }

  async function onScan() {
    setScanning(true);
    const r = await syncWatch(true);
    // 서버가 찾은 새 공고를 이 기기의 "받은 알림"에도 남긴다(다음 조사 뒤에도 사라지지 않게)
    if (!r.error) {
      await checkAlerts();
      setLog(loadAlertLog());
    }
    setScanning(false);
    setRs(r);
    setNote(r.error ?? `다시 조사했습니다. 새 공고 ${r.lastNewTitles?.length ?? 0}건.`);
  }

  function onClear() {
    void deleteServerWatch(); // 서버에 저장된 조건·구독도 함께 삭제
    clearWatch();
    setWatch(null);
    setNote("알림 조건을 삭제했습니다. 서버에 저장된 내용도 삭제했습니다.");
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500">
          ← 처음으로
        </Link>
        <h1 className="text-lg font-bold">내 알림</h1>
        <button onClick={() => setTab("설정")} className="text-sm text-indigo-700">
          설정
        </button>
      </header>

      <div role="tablist" aria-label="알림함 메뉴" className="grid grid-cols-4 border-b border-slate-200">
        {TABS.map((name, index) => (
          <button key={name} role="tab" id={`alert-tab-${index}`} aria-selected={tab === name}
            aria-controls="alert-panel" tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!offset && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + offset + TABS.length) % TABS.length;
              setTab(TABS[next]);
              document.getElementById(`alert-tab-${next}`)?.focus();
            }}
            className={`min-h-11 border-b-2 px-1 py-3 text-sm ${tab === name ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-slate-600 hover:bg-indigo-50"}`}>
            {name}
          </button>
        ))}
      </div>
      <div id="alert-panel" role="tabpanel" aria-labelledby={`alert-tab-${TABS.indexOf(tab)}`} className="space-y-4">
      {tab === "리서치 현황" && !watch && <p className="text-sm text-slate-500">저장한 알림 조건이 없습니다. 저장 조건 탭에서 안내를 확인할 수 있습니다.</p>}
      {tab === "리서치 현황" && watch && (
        <section className="app-card space-y-2 border-indigo-100 bg-indigo-50 p-4 text-sm text-slate-900">
          <h2 className="font-semibold">반복 리서치 현황</h2>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1">
            <dt className="text-slate-500">조사 주기</dt>
            <dd>{rs?.schedule ?? "매일 오전 9시(KST) 자동 조사"}</dd>
            <dt className="text-slate-500">마지막 조사</dt>
            <dd>{rs?.lastScanAt ? new Date(rs.lastScanAt).toLocaleString("ko-KR") : "아직 없음"}</dd>
            <dt className="text-slate-500">조사한 출처</dt>
            <dd className="flex flex-wrap gap-1">
              {rs?.lastSources?.length
                ? rs.lastSources.map((src) => {
                    const sample = rs.history?.at(-1)?.failedSources.includes(src);
                    return (
                      <span
                        key={src}
                        className={`rounded px-1.5 text-xs ${sample ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}
                      >
                        {src} {sample ? "예시" : "실데이터"}
                      </span>
                    );
                  })
                : "-"}
            </dd>
            <dt className="text-slate-500">누적 새 공고</dt>
            <dd>{rs?.totalNew ?? 0}건</dd>
            <dt className="text-slate-500">푸시</dt>
            <dd>{rs?.pushEnabled ? "켜짐(앱을 닫아도 도착)" : "꺼짐(앱을 열 때 종 아이콘에 표시)"}</dd>
          </dl>
          {rs?.lastNewTitles && rs.lastNewTitles.length > 0 && (
            <PaginatedList label="최근 조사 공고" className="list-disc pl-5 text-xs text-slate-700">
              {rs.lastNewTitles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </PaginatedList>
          )}
          <div className="border-t border-indigo-100 pt-2">
            <h3 className="mb-1 font-semibold">이번 주 리서치 리포트</h3>
            <WeeklyReport history={rs?.history ?? []} />
          </div>
          <button
            onClick={onScan}
            disabled={scanning}
            className="w-full rounded-xl bg-indigo-600 py-2 font-semibold text-white disabled:opacity-50"
          >
            {scanning ? "조사 중…" : "지금 다시 조사하기"}
          </button>
        </section>
      )}

      {tab === "저장 조건" && <section className="app-card space-y-2 p-4 text-slate-900">
        <h2 className="font-semibold">저장한 조건</h2>
        {!watch ? (
          <p className="text-sm text-slate-500">
            아직 없습니다.{" "}
            <Link href="/play" className="text-indigo-700 underline">
              게임
            </Link>
            을 하고 결과 화면에서 &quot;이 조건으로 저장하고 알림 받기&quot;를 선택하면 됩니다.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {(watch.domains.length ? watch.domains : []).map((d) => (
                <span key={d} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                  {DOMAIN_META[d].label}
                </span>
              ))}
            </div>
            <PaginatedList label="저장 답변" className="space-y-2 text-sm text-slate-700">
              {watch.answers.map((a) => (
                <li key={a.question.id}>
                  {a.question.text} <b className="text-slate-900">{ANSWER_LABEL[a.answer]}</b>
                </li>
              ))}
            </PaginatedList>
            <p className="text-xs text-slate-400">
              {new Date(watch.createdAt).toLocaleString("ko-KR")} 저장 · 이미 본 공고 {watch.seenIds.length}개
            </p>
            <button onClick={onClear} className="text-xs text-slate-500 underline">
              조건 지우기
            </button>
          </>
        )}
      </section>}

      {tab === "설정" && <section className="space-y-2">
        <h2 className="font-semibold">알림 설정</h2>
        <Link href="/settings" className="inline-block text-sm text-indigo-700 underline">전체 설정 열기</Link>
        {perm === "granted" && <p className="text-sm text-slate-600">브라우저 알림이 켜져 있습니다.</p>}
        {perm === "unsupported" && <p className="text-sm text-slate-600">이 브라우저는 시스템 알림을 지원하지 않습니다.</p>}
        {perm === "default" && (
          <button onClick={onPermission} className="w-full rounded-2xl bg-indigo-600 py-3 font-semibold text-white">
            브라우저 알림 켜기
          </button>
        )}
        {perm === "denied" && (
          <p className="text-center text-xs text-slate-500">브라우저 알림이 차단돼 있습니다. 앱을 열 때 이 화면에 모아 표시합니다.</p>
        )}
        <button
          onClick={onCheck}
          disabled={!watch}
          className="w-full rounded-2xl border-2 border-indigo-600 bg-white py-3 font-semibold text-indigo-700 disabled:opacity-40"
        >
          새 공고 확인
        </button>
        {pushKey && (
          <button onClick={onPush} className="w-full rounded-2xl bg-slate-800 py-3 text-sm font-semibold text-white">
            서버 푸시 테스트 (Web Push)
          </button>
        )}
      </section>}

      {tab === "받은 알림" && <section className="space-y-2">
        <h2 className="font-semibold">받은 알림 {log.length > 0 && <span className="text-slate-400">{log.length}</span>}</h2>
        {alertId && <div className="text-sm text-slate-600">
          <p>{log.some((a) => a.id === alertId) ? "선택한 알림의 공고입니다." : "선택한 알림의 보관 기간이 지나 목록에서 찾을 수 없습니다."}</p>
          <button onClick={() => { setAlertId(null); window.history.replaceState(null, "", "/alerts"); }} className="text-indigo-700 underline">전체 알림 보기</button>
        </div>}
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">아직 받은 알림이 없습니다.</p>
        ) : (
          <PaginatedList key={alertId ?? "all"} label="받은 공고">
            {log.filter((a) => !alertId || a.id === alertId).map((a) => (
              <li key={a.id + a.createdAt} className="rounded-xl bg-white p-3 text-slate-900 shadow-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 ${a.kind === "new" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}
                  >
                    {a.kind === "new" ? "새 공고" : "마감 임박"}
                  </span>
                  {!a.read && <span className="h-2 w-2 rounded-full bg-rose-600" aria-label="안 읽음" />}
                  <span className="ml-auto text-slate-400">{new Date(a.createdAt).toLocaleString("ko-KR")}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{a.title}</p>
                <p className="text-xs text-slate-500">{a.body}</p>
                {a.url.startsWith("http") && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">
                    원문 보기 ↗
                  </a>
                )}
              </li>
            ))}
          </PaginatedList>
        )}
      </section>}
      {note && <p role="status" className="text-center text-xs text-slate-600">{note}</p>}
      </div>
    </main>
  );
}
