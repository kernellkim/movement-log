// Pure helpers for the member's read-only schedule screen. Reads the member_schedule view,
// which exposes only these columns (no memo / trainer_id / member_id).
import { addDays, STATUS_LABEL, type EventStatus } from "./schedule.ts";

export type MemberScheduleEvent = {
  id: string;
  event_date: string; // plain "YYYY-MM-DD"
  start_time: string; // Postgres returns HH:MM:SS
  end_time: string;
  status: EventStatus;
  title: string;
};

export const MEMBER_SCHEDULE_COLUMNS = "id, event_date, start_time, end_time, status, title";
export const PAST_DAYS = 7;
export const FUTURE_DAYS = 60;

// "Today" as a calendar date in Asia/Seoul (sv-SE formats as YYYY-MM-DD), never UTC.
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

export function defaultRange(today: string): { from: string; to: string } {
  return { from: addDays(today, -PAST_DAYS), to: addDays(today, FUTURE_DAYS) };
}

export function statusLabel(s: EventStatus): string {
  return STATUS_LABEL[s] ?? s;
}

export type DayGroup = { date: string; events: MemberScheduleEvent[] };

// Upcoming days (today and later) ascending, then past days newest first.
export function groupForMember(events: MemberScheduleEvent[], today: string) {
  const byDate = new Map<string, MemberScheduleEvent[]>();
  for (const ev of events) {
    const list = byDate.get(ev.event_date) ?? [];
    list.push(ev);
    byDate.set(ev.event_date, list);
  }
  const days: DayGroup[] = [...byDate].map(([date, list]) => ({
    date,
    events: list.sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));
  const upcoming = days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = days.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}
