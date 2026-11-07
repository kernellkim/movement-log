// Pure helpers for the trainer calendar. Dates are plain "YYYY-MM-DD" strings and times
// "HH:MM" strings (KST wall-clock, no time zone). Date math runs in UTC on purpose so the
// machine's time zone never shifts a day, and nothing here uses toISOString().

export type EventStatus = "scheduled" | "done" | "cancelled";

export type ScheduleEvent = {
  id: string;
  member_id: string | null;
  title: string;
  event_date: string;
  start_time: string; // Postgres returns HH:MM:SS
  end_time: string;
  status: EventStatus;
  memo: string;
  visible_to_member: boolean;
};

export const STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "예정",
  done: "완료",
  cancelled: "취소",
};

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

export function parseYmd(s: string): { y: number; m0: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m0: m - 1, d };
}

function utc(s: string): Date {
  const { y, m0, d } = parseYmd(s);
  return new Date(Date.UTC(y, m0, d));
}

function fromUtc(dt: Date): string {
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function addDays(s: string, n: number): string {
  const dt = utc(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

export function weekday(s: string): number {
  return utc(s).getUTCDay(); // 0 = Sunday
}

// Same day-of-month one month away, clamped to the last day of the target month.
export function addMonths(s: string, n: number): string {
  const { y, m0, d } = parseYmd(s);
  const total = y * 12 + m0 + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return ymd(ny, nm, Math.min(d, last));
}

export function weekDays(s: string): string[] {
  const start = addDays(s, -weekday(s));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Always 6 rows x 7 columns (Sunday first) so the grid height never jumps between months.
export function monthGrid(s: string): string[] {
  const { y, m0 } = parseYmd(s);
  const first = ymd(y, m0, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function formatDayKo(s: string): string {
  const { m0, d } = parseYmd(s);
  return `${m0 + 1}월 ${d}일 (${WEEKDAYS_KO[weekday(s)]})`;
}

export type EventForm = {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
};

export type EventErrors = Partial<Record<keyof EventForm, string>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateEvent(f: EventForm): EventErrors {
  const e: EventErrors = {};
  if (!f.title.trim()) e.title = "제목을 입력해 주세요.";
  if (!DATE_RE.test(f.event_date) || fromUtc(utc(f.event_date)) !== f.event_date) {
    e.event_date = "날짜를 선택해 주세요.";
  }
  if (!TIME_RE.test(f.start_time)) e.start_time = "시작 시간을 입력해 주세요.";
  if (!TIME_RE.test(f.end_time)) e.end_time = "종료 시간을 입력해 주세요.";
  if (!e.start_time && !e.end_time && f.end_time <= f.start_time) {
    e.end_time = "종료 시간은 시작 시간보다 늦어야 합니다.";
  }
  return e;
}

export function groupByDate(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.event_date) ?? [];
    list.push(ev);
    map.set(ev.event_date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return map;
}

// PostgREST says PGRST205 when a table is not in its schema cache; Postgres says 42P01.
export function isMissingTableError(err: { code?: string; message?: string }): boolean {
  return (
    err.code === "PGRST205" ||
    err.code === "42P01" ||
    /schema cache|does not exist/i.test(err.message ?? "")
  );
}
