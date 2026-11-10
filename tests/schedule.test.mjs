// Run: npm test  (Node's built-in runner, TS type stripping; no extra dependency)
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays, addMonths, monthGrid, weekDays, weekday, validateEvent, groupByDate, hhmm, isMissingTableError,
} from "../lib/schedule.ts";

test("addDays crosses month/year/leap boundaries", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("addMonths clamps to month end", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
});

test("weekday and weekDays (Sunday first)", () => {
  assert.equal(weekday("2026-10-28"), 3); // Wednesday
  assert.deepEqual(weekDays("2026-10-28")[0], "2026-10-25");
  assert.equal(weekDays("2026-10-28")[6], "2026-10-31");
});

test("monthGrid is 42 days starting on a Sunday and contains the month", () => {
  const g = monthGrid("2026-11-10");
  assert.equal(g.length, 42);
  assert.equal(weekday(g[0]), 0);
  assert.ok(g.includes("2026-11-01") && g.includes("2026-11-30"));
});

test("validateEvent", () => {
  const ok = { title: "김회원", event_date: "2026-10-28", start_time: "10:00", end_time: "11:00" };
  assert.deepEqual(validateEvent(ok), {});
  assert.ok(validateEvent({ ...ok, title: "  " }).title);
  assert.ok(validateEvent({ ...ok, end_time: "10:00" }).end_time);
  assert.ok(validateEvent({ ...ok, end_time: "09:00" }).end_time);
  assert.ok(validateEvent({ ...ok, event_date: "2026-02-30" }).event_date);
  assert.ok(validateEvent({ ...ok, start_time: "" }).start_time);
});

test("groupByDate sorts by start time; hhmm trims seconds", () => {
  const mk = (id, s) => ({ id, event_date: "2026-10-28", start_time: s });
  const m = groupByDate([mk("b", "14:00:00"), mk("a", "09:00:00")]);
  assert.deepEqual(m.get("2026-10-28").map((e) => e.id), ["a", "b"]);
  assert.equal(hhmm("09:30:00"), "09:30");
});

test("isMissingTableError", () => {
  assert.ok(isMissingTableError({ code: "PGRST205" }));
  assert.ok(isMissingTableError({ code: "42P01" }));
  assert.ok(!isMissingTableError({ code: "42501", message: "permission denied" }));
});

import {
  todayKst, defaultRange, groupForMember, statusLabel,
} from "../lib/member-schedule.ts";

test("todayKst uses Asia/Seoul, not UTC", () => {
  assert.equal(todayKst(new Date("2026-11-10T16:30:00Z")), "2026-11-11"); // 01:30 KST next day
  assert.equal(todayKst(new Date("2026-11-10T14:59:00Z")), "2026-11-10");
});

test("defaultRange is 7 days back and 60 ahead", () => {
  assert.deepEqual(defaultRange("2026-11-10"), { from: "2026-11-03", to: "2027-01-09" });
});

test("statusLabel gives Korean labels", () => {
  assert.equal(statusLabel("scheduled"), "예정");
  assert.equal(statusLabel("done"), "완료");
  assert.equal(statusLabel("cancelled"), "취소");
});

test("groupForMember: upcoming ascending, then past newest first, times sorted", () => {
  const ev = (id, d, s) => ({ id, event_date: d, start_time: s, end_time: "23:00:00", status: "scheduled", title: id });
  const { upcoming, past } = groupForMember(
    [ev("a", "2026-11-12", "10:00:00"), ev("b", "2026-11-10", "15:00:00"), ev("c", "2026-11-10", "09:00:00"),
     ev("d", "2026-11-05", "09:00:00"), ev("e", "2026-11-08", "09:00:00")],
    "2026-11-10",
  );
  assert.deepEqual(upcoming.map((g) => g.date), ["2026-11-10", "2026-11-12"]);
  assert.deepEqual(upcoming[0].events.map((e) => e.id), ["c", "b"]);
  assert.deepEqual(past.map((g) => g.date), ["2026-11-08", "2026-11-05"]);
});
