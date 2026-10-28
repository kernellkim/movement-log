// LOCAL ONLY demo data for the trainer calendar: 1 fake trainer, 3 fake members (one with a
// login), ~15 events across this month and next. Refuses to run unless the API is on 127.0.0.1.
//
// Prereqs: `supabase start` (+ `supabase db reset` for a clean DB), Docker running.
// Usage:   node supabase/ops/seed_local_schedule.mjs
// Accounts (fake): sched-trainer@test.local / sched-trainer-pw, sched-member@test.local / sched-member-pw
// Re-running is safe: users and events are upserted by fixed ids/emails.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const API_URL = "http://127.0.0.1:54321";
const SERVICE_KEY = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" })
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?/m)?.[1];
if (!SERVICE_KEY) throw new Error("could not read local SERVICE_ROLE_KEY from `supabase status`");
const db = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function user(email, password) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) return data.user.id;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (!found) throw error;
  return found.id;
}

const trainerId = await user("sched-trainer@test.local", "sched-trainer-pw");
const memberUserId = await user("sched-member@test.local", "sched-member-pw");

// Register the trainer with the real ops snippet, executed inside the local DB container.
execFileSync(
  "docker",
  ["exec", "-i", "supabase_db_Fitness01", "psql", "-U", "postgres", "-v", `trainer_user_id=${trainerId}`, "-f", "-"],
  { input: readFileSync(new URL("./register_trainer.sql", import.meta.url)), stdio: ["pipe", "inherit", "inherit"] },
);

const M = [
  ["aaaaaaaa-0000-4000-8000-000000000001", "김가상", memberUserId],
  ["aaaaaaaa-0000-4000-8000-000000000002", "이가상", null],
  ["aaaaaaaa-0000-4000-8000-000000000003", "박가상", null],
];
await db.from("members").upsert(M.map(([id, name, user_id]) => ({ id, name, user_id, trainer_id: trainerId })));

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const [y, m] = today.split("-").map(Number);
const day = (offsetMonth, d) => {
  const t = y * 12 + (m - 1) + offsetMonth;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
// [month offset, day, start, end, member idx|null, title, status, visible, memo]
const E = [
  [0, 2, "10:00", "11:00", 0, "김가상", "done", true, "스쿼트 자세 교정"],
  [0, 5, "19:00", "20:00", 1, "이가상", "done", true, ""],
  [0, 9, "09:00", "10:00", 2, "박가상", "cancelled", true, "개인 사정으로 취소"],
  [0, 12, "14:00", "15:00", null, "센터 회의", "scheduled", true, "개인 일정"],
  [0, 16, "10:00", "11:00", 0, "김가상", "done", true, ""],
  [0, 20, "18:00", "19:00", 1, "이가상", "done", false, "회원에게 숨김 예시"],
  [0, 28, "10:00", "11:00", 0, "김가상", "scheduled", true, ""],
  [0, 28, "11:30", "12:30", 2, "박가상", "scheduled", true, "무릎 상태 확인"],
  [0, 28, "19:00", "20:00", 1, "이가상", "scheduled", true, ""],
  [0, 30, "08:00", "09:00", null, "개인 운동", "scheduled", true, ""],
  [1, 2, "10:00", "11:00", 0, "김가상", "scheduled", true, ""],
  [1, 4, "19:00", "20:00", 1, "이가상", "scheduled", true, ""],
  [1, 4, "20:00", "21:00", 2, "박가상", "scheduled", true, ""],
  [1, 4, "21:00", "22:00", null, "스터디", "scheduled", true, ""],
  [1, 4, "07:00", "08:00", null, "아침 러닝", "scheduled", true, ""],
  [1, 11, "13:00", "14:00", 2, "박가상", "scheduled", true, ""],
];
const now = new Date().toISOString();
const rows = E.map(([mo, d, s, e, mi, title, status, visible, memo], i) => ({
  id: `bbbbbbbb-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  trainer_id: trainerId,
  member_id: mi === null ? null : M[mi][0],
  title, event_date: day(mo, d), start_time: s, end_time: e, status,
  visible_to_member: visible, memo, updated_at: now,
}));
const { error } = await db.from("schedule_events").upsert(rows);
if (error) throw error;
console.log(`seeded: trainer ${trainerId}, ${M.length} members, ${rows.length} events`);
