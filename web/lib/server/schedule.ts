import type { WatchSchedule } from "@/lib/types";
import type { WatchRecord } from "./store";

const KST_OFFSET = 9 * 60;
const DEFAULT_SCHEDULE: WatchSchedule = { kind: "daily", times: ["09:00"], quiet: null };

function minuteOfDay(date: Date): number {
  const kst = new Date(date.getTime() + KST_OFFSET * 60_000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function dayKey(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET * 60_000).toISOString().slice(0, 10);
}

function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function inQuiet(schedule: WatchSchedule, now: Date): boolean {
  const quiet = schedule.quiet;
  if (!quiet) return false;
  const start = parseTime(quiet.start);
  const end = parseTime(quiet.end);
  if (start === null || end === null || start === end) return false;
  const current = minuteOfDay(now);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function normalizeSchedule(schedule?: WatchSchedule): WatchSchedule {
  if (!schedule) return DEFAULT_SCHEDULE;
  if (schedule.kind === "interval") {
    const allowed = [1, 5, 15, 30, 60, 180, 360];
    return {
      kind: "interval",
      intervalMin: allowed.includes(schedule.intervalMin ?? 0) ? schedule.intervalMin : 1,
      quiet: schedule.quiet ?? null,
    };
  }
  const limit = schedule.kind === "daily" ? 1 : 3;
  const times = [...new Set((schedule.times ?? []).filter((time) => parseTime(time) !== null))]
    .sort()
    .slice(0, limit);
  return {
    kind: schedule.kind,
    times: times.length ? times : ["09:00"],
    quiet: schedule.quiet ?? null,
  };
}

/** KST 일정과 마지막 실제 확인 시각을 기준으로 이번 cron 호출에서 조사할지 결정한다. */
export function isDue(rec: WatchRecord, now = new Date()): boolean {
  const schedule = normalizeSchedule(rec.watch.schedule);
  if (inQuiet(schedule, now)) return false;
  if (!rec.lastScanAt) return true;
  const last = new Date(rec.lastScanAt);
  if (!Number.isFinite(last.getTime()) || last > now) return true;

  if (schedule.kind === "interval") {
    return now.getTime() - last.getTime() >= (schedule.intervalMin ?? 15) * 60_000;
  }

  const current = minuteOfDay(now);
  const lastDay = dayKey(last);
  const today = dayKey(now);
  return (schedule.times ?? ["09:00"]).some((value) => {
    const time = parseTime(value);
    return time !== null && current >= time && (lastDay !== today || minuteOfDay(last) < time);
  });
}
