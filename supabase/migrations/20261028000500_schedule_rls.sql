-- Trainer-only access to schedule_events. anon gets nothing. authenticated gets
-- select/insert/update only: no DELETE (soft delete via deleted_at) and no TRUNCATE
-- (it would bypass RLS). There is deliberately NO policy for members on this table:
-- members read through public.member_schedule (next migration), never the base table,
-- so the memo column is unreachable for them.

alter table public.schedule_events enable row level security;

revoke all on public.schedule_events from anon, authenticated;
grant select, insert, update on public.schedule_events to authenticated;

create policy evt_trainer_select on public.schedule_events
  for select to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer());

create policy evt_trainer_insert on public.schedule_events
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
  );

create policy evt_trainer_update on public.schedule_events
  for update to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer())
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
  );
