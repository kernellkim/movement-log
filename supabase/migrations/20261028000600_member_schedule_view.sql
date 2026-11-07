-- Read-only schedule for PT members.
--
-- Why SECURITY DEFINER (the default, i.e. security_invoker = false):
--   schedule_events has no member policy on purpose, so a security_invoker view would run
--   the query as the member, RLS would hide every row and the view would always be empty.
--   Giving members a policy on the base table instead would expose the memo column,
--   because column privileges cannot tell a trainer from a member (same `authenticated`
--   role). So the view runs as its owner (postgres, which bypasses RLS) and does the
--   row filtering itself.
--
-- Why it cannot leak:
--   * rows: the only way in is the join to members.user_id = auth.uid(). auth.uid() reads
--     the caller's JWT claim (not the view owner), so every caller gets only their own
--     member rows; NULL (anon) matches nothing. Other members' and other trainers' events
--     have other member_ids, so they never join.
--   * columns: an explicit list. memo, trainer_id, member_id, visible_to_member,
--     server_updated_at, updated_at, deleted_at are not selectable.
--   * security_barrier: callers cannot use a leaky function in their own WHERE to peek
--     at rows before the view's filter runs.
--   * grants: authenticated only; anon has none.
-- Supabase's advisor flags definer views (lint 0010). That is expected here and is the
-- reason this view is small, explicit and covered by tests.

create view public.member_schedule
with (security_barrier = true) as
select e.id, e.event_date, e.start_time, e.end_time, e.status, e.title
from public.schedule_events e
join public.members m on m.id = e.member_id
where m.user_id = (select auth.uid())
  and e.deleted_at is null
  and e.visible_to_member;

revoke all on public.member_schedule from anon, authenticated;
grant select on public.member_schedule to authenticated;
