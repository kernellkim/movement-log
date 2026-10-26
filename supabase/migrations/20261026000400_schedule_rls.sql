-- Schedule integration, step 1d: grants + RLS.
-- anon gets nothing. authenticated gets select/insert/update only (no DELETE anywhere:
-- soft delete for lessons/enrollments, append-only for signatures). No TRUNCATE either,
-- since it would bypass RLS.

alter table public.schedule_enrollments enable row level security;
alter table public.schedule_lessons enable row level security;
alter table public.schedule_signatures enable row level security;

revoke all on public.schedule_enrollments, public.schedule_lessons, public.schedule_signatures
  from anon, authenticated;
grant select, insert, update
  on public.schedule_enrollments, public.schedule_lessons, public.schedule_signatures
  to authenticated;

-- ---- enrollments --------------------------------------------------------
create policy enr_trainer_select on public.schedule_enrollments
  for select to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer());

create policy enr_trainer_insert on public.schedule_enrollments
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
  );

create policy enr_trainer_update on public.schedule_enrollments
  for update to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer())
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
  );

create policy enr_member_read on public.schedule_enrollments
  for select to authenticated
  using (deleted_at is null and member_id in (
          select id from public.members where user_id = (select auth.uid())));

-- ---- lessons ------------------------------------------------------------
create policy les_trainer_select on public.schedule_lessons
  for select to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer());

create policy les_trainer_insert on public.schedule_lessons
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
    and (enrollment_id is null or exists (
          select 1 from public.schedule_enrollments e
          where e.id = enrollment_id and e.trainer_id = (select auth.uid())))
  );

create policy les_trainer_update on public.schedule_lessons
  for update to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer())
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (member_id is null or exists (
          select 1 from public.members m
          where m.id = member_id and m.trainer_id = (select auth.uid())))
    and (enrollment_id is null or exists (
          select 1 from public.schedule_enrollments e
          where e.id = enrollment_id and e.trainer_id = (select auth.uid())))
  );

create policy les_member_read on public.schedule_lessons
  for select to authenticated
  using (deleted_at is null and member_id in (
          select id from public.members where user_id = (select auth.uid())));

-- ---- signatures (no DELETE policy) --------------------------------------
create policy sig_trainer_select on public.schedule_signatures
  for select to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer());

create policy sig_trainer_insert on public.schedule_signatures
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid()) and private.is_trainer()
    and (lesson_id is null or exists (
          select 1 from public.schedule_lessons l
          where l.id = lesson_id and l.trainer_id = (select auth.uid())))
    and (enrollment_id is null or exists (
          select 1 from public.schedule_enrollments e
          where e.id = enrollment_id and e.trainer_id = (select auth.uid())))
  );

-- Only voided_at can change (trigger); the policy still pins ownership.
create policy sig_trainer_update on public.schedule_signatures
  for update to authenticated
  using (trainer_id = (select auth.uid()) and private.is_trainer())
  with check (trainer_id = (select auth.uid()) and private.is_trainer());

-- signatures have no member_id: members reach them through their own non-deleted
-- lesson / enrollment.
create policy sig_member_read on public.schedule_signatures
  for select to authenticated
  using (
    lesson_id in (
      select l.id from public.schedule_lessons l
      where l.deleted_at is null
        and l.member_id in (select id from public.members where user_id = (select auth.uid())))
    or enrollment_id in (
      select e.id from public.schedule_enrollments e
      where e.deleted_at is null
        and e.member_id in (select id from public.members where user_id = (select auth.uid())))
  );
