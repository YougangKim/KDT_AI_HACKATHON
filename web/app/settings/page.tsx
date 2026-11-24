"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Domain, Watch, WatchSchedule } from "@/lib/types";
import { updateAnswers, type AnswerChange } from "@/lib/engine/answer-groups";
import { buildWatch, loadWatch, saveWatch } from "@/lib/alerts";
import { readLastResult } from "@/components/result/lastResult";
import { researchStatus, syncWatch, type ResearchStatus } from "@/lib/alerts/client";
import { ConditionEditor } from "@/components/result/ConditionEditor";
import { LocationStep } from "@/components/game/LocationStep";
import { DOMAIN_META } from "@/components/result/domain";
import { Icon } from "@/components/brand/Icons";

const DOMAINS: Domain[] = ["housing", "job", "parttime", "benefit", "training", "exam"];
const INTERVALS = [
  [1, "1분"],
  [5, "5분"],
  [15, "15분"],
  [30, "30분"],
  [60, "1시간"],
  [180, "3시간"],
  [360, "6시간"],
] as const;

const defaultSchedule = (): WatchSchedule => ({
  kind: "daily",
  times: ["09:00"],
  quiet: null,
});

function timeParts(value = "09:00") {
  const [hour = "09", minute = "00"] = value.split(":");
  return { hour, minute };
}

function TimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { hour, minute } = timeParts(value);
  return (
    <span className="flex items-center gap-1">
      <select aria-label="시" value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((item) => (
          <option key={item} value={item}>{Number(item) < 12 ? "오전" : "오후"} {Number(item) % 12 || 12}시</option>
        ))}
      </select>
      <select aria-label="분" value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
        {["00", "10", "20", "30", "40", "50"].map((item) => <option key={item}>{item}</option>)}
      </select>
    </span>
  );
}

export default function SettingsPage() {
  const [watch, setWatch] = useState<Watch | null>(null);
  const [status, setStatus] = useState("");
  const [server, setServer] = useState<ResearchStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = loadWatch();
    if (!current) {
      // 알림을 아직 저장하지 않았어도 방금 마친 인터뷰 답으로 설정을 시작한다(질문을 다시 하지 않게)
      const last = readLastResult();
      if (last?.answers.length) {
        current = { ...buildWatch(last.answers, last.matches), location: last.location };
        setStatus("방금 인터뷰한 조건을 불러왔습니다. 아래에서 확인하고 저장하면 알림이 켜집니다.");
      }
    }
    setWatch(current ? {
      ...current,
      schedule: current.schedule ?? defaultSchedule(),
      mode: current.mode ?? "new-only",
    } : null);
    if (current) void researchStatus().then(setServer);
  }, []);

  function updateAnswer(changes: AnswerChange[]) {
    setWatch((current) => current ? {
      ...current,
      answers: updateAnswers(current.answers, changes),
    } : current);
  }

  function updateSchedule(next: Partial<WatchSchedule>) {
    setWatch((current) => current ? {
      ...current,
      schedule: { ...(current.schedule ?? defaultSchedule()), ...next },
    } : current);
  }

  function updateTime(index: number, value: string) {
    const times = [...(watch?.schedule?.times ?? ["09:00"])];
    times[index] = value;
    updateSchedule({ times });
  }

  async function onSave() {
    if (!watch) return;
    setSaving(true);
    setStatus("");
    saveWatch(watch);
    const result = await syncWatch();
    setServer(result);
    setSaving(false);
    setStatus(result.saved && !result.error
      ? "저장했습니다. 이 기기와 서버에 알림 설정을 반영했습니다."
      : `이 기기에는 저장했지만 서버 동기화에 실패했습니다${result.error ? `: ${result.error}` : "."}`);
  }

  if (!watch) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Icon name="settings" className="h-5 w-5" />알림 설정</h1>
        <p className="text-sm text-slate-600">먼저 질문에 답하고 알림 조건을 저장해야 합니다.</p>
        <Link href="/play" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">질문 시작하기</Link>
      </main>
    );
  }

  const schedule = watch.schedule ?? defaultSchedule();
  const times = schedule.times?.length ? schedule.times : ["09:00"];
  const cronHealthy = server?.lastCronAt
    ? Date.now() - new Date(server.lastCronAt).getTime() < 30 * 60_000
    : false;

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <header className="flex items-center justify-between">
        <Link href="/alerts" className="text-sm text-slate-500">← 알림함</Link>
        <h1 className="flex items-center gap-1 text-lg font-bold"><Icon name="settings" className="h-5 w-5" />알림 설정</h1>
        <Link href="/play" className="text-sm text-indigo-700 underline">질문 다시 하기</Link>
      </header>

      <section className="app-card space-y-3 border-indigo-100 bg-indigo-50 p-4">
        <details><summary className="min-h-11 cursor-pointer content-center font-semibold">내 조건 수정</summary>
          <ConditionEditor answers={watch.answers} onChange={updateAnswer} />
        </details>
      </section>

      <section className="app-card space-y-2 p-4">
        <h2 className="font-semibold">관심 분야</h2>
        <div className="grid grid-cols-2 gap-2">
          {DOMAINS.map((domain) => {
            const active = watch.domains.includes(domain);
            return (
              <button
                key={domain}
                type="button"
                aria-pressed={active}
                onClick={() => setWatch({
                  ...watch,
                  domains: active ? watch.domains.filter((item) => item !== domain) : [...watch.domains, domain],
                })}
                className={`rounded-xl p-2 text-sm font-semibold ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                <span className="mr-1 inline-grid h-6 w-6 place-items-center rounded-md text-white align-[-6px]" style={{ backgroundColor: DOMAIN_META[domain].color }} aria-hidden>
                  <Icon name={DOMAIN_META[domain].icon} className="h-4 w-4" />
                </span>
                {DOMAIN_META[domain].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-card p-4">
        <LocationStep
          settings
          initial={watch.location}
          onComplete={(location) => setWatch({ ...watch, location })}
          onSkip={() =>
            setWatch((current) => {
              if (!current) return current;
              const next = { ...current };
              delete next.location; // 위치 지우기 → 저장 시 서버에서도 삭제
              return next;
            })
          }
        />
      </section>

      <section className="app-card space-y-3 p-4">
        <h2 className="font-semibold">알림 일정</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["daily", "하루 1회"],
            ["times", "특정 시각"],
            ["interval", "간격"],
          ].map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={schedule.kind === kind}
              onClick={() => updateSchedule({ kind: kind as WatchSchedule["kind"], times: ["09:00"], intervalMin: 5 })}
              className={`rounded-xl p-2 text-sm font-semibold ${schedule.kind === kind ? "bg-indigo-600 text-white" : "bg-slate-100"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {schedule.kind === "daily" && <TimePicker value={times[0]} onChange={(value) => updateTime(0, value)} />}
        {schedule.kind === "times" && (
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center justify-between">
                <TimePicker value={time} onChange={(value) => updateTime(index, value)} />
                {times.length > 1 && <button type="button" onClick={() => updateSchedule({ times: times.filter((_, item) => item !== index) })} className="text-xs text-rose-600 underline">삭제</button>}
              </div>
            ))}
            {times.length < 3 && <button type="button" onClick={() => updateSchedule({ times: [...times, "18:00"] })} className="text-sm text-indigo-700 underline">+ 시각 추가 (최대 3개)</button>}
          </div>
        )}
        {schedule.kind === "interval" && (
          <div role="group" aria-label="알림 간격" className="grid grid-cols-3 gap-2">
            {INTERVALS.map(([minutes, label]) => (
              <button key={minutes} type="button" aria-pressed={schedule.intervalMin === minutes} onClick={() => updateSchedule({ intervalMin: minutes })} className={`rounded-lg p-2 text-sm ${schedule.intervalMin === minutes ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center justify-between gap-3 text-sm">
          <span>방해 금지 시간</span>
          <input type="checkbox" checked={Boolean(schedule.quiet)} onChange={(event) => updateSchedule({ quiet: event.target.checked ? { start: "23:00", end: "08:00" } : null })} />
        </label>
        {schedule.quiet && (
          <div className="flex items-center gap-2 text-sm">
            <input aria-label="방해 금지 시작" type="time" value={schedule.quiet.start} onChange={(event) => updateSchedule({ quiet: { ...schedule.quiet!, start: event.target.value } })} className="rounded-lg p-2 ring-1 ring-slate-200" />
            <span>~</span>
            <input aria-label="방해 금지 종료" type="time" value={schedule.quiet.end} onChange={(event) => updateSchedule({ quiet: { ...schedule.quiet!, end: event.target.value } })} className="rounded-lg p-2 ring-1 ring-slate-200" />
          </div>
        )}
        <p className="text-xs text-slate-500">간격 알림은 외부 스케줄러(cron-job.org, 1분마다 호출)가 켜져 있어야 동작합니다.</p>
        <p className={`text-xs ${cronHealthy ? "text-emerald-700" : "text-amber-700"}`}>
          현재 상태: {cronHealthy ? "최근 30분 안에 호출됨" : "최근 호출을 확인하지 못함"}
        </p>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">알림 모드</h2>
        <button type="button" aria-pressed={(watch.mode ?? "new-only") === "new-only"} onClick={() => setWatch({ ...watch, mode: "new-only" })} className={`w-full rounded-xl p-3 text-sm font-semibold ${(watch.mode ?? "new-only") === "new-only" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>새 공고가 있을 때만</button>
        <button type="button" aria-pressed={watch.mode === "digest"} onClick={() => setWatch({ ...watch, mode: "digest" })} className={`w-full rounded-xl p-3 text-sm font-semibold ${watch.mode === "digest" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>정해진 시간마다 요약 받기</button>
        <p className="text-xs text-slate-500">요약 모드는 새 공고가 없어도 맞는 공고 수와 마감 임박 수를 알립니다.</p>
      </section>

      <button type="button" disabled={saving} onClick={onSave} className="rounded-2xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50">
        {saving ? "저장 중…" : "설정 저장"}
      </button>
      {status && <p role="status" className="text-center text-sm text-slate-600">{status}</p>}
    </main>
  );
}
