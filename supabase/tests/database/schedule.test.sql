-- Schedule calendar: RLS cross-access, write trigger, FK behaviour, member view, members hardening.
-- Fake data only.
-- Run: supabase test db
begin;
select plan(97);

-- ---- helpers: impersonate a role + JWT subject -----------------------------
create schema tests;
grant usage on schema tests to public;

create function tests.as_user(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function tests.rows_updated(stmt text) returns int language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

create function tests.as_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

create function tests.as_service() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end $$;

create function tests.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- new functions get no PUBLIC execute (20261026000900), so the helpers are granted explicitly
grant execute on all functions in schema tests to public;

-- users: ta/tb trainers, ma/mb member logins, nt = authenticated but not a trainer
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'ta@test.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'tb@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a1', 'ma@test.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-0000000000b1', 'mb@test.local', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-0000000000c0', 'nt@test.local', 'authenticated', 'authenticated');
insert into public.trainers (user_id) values
  ('a0000000-0000-0000-0000-00000000000a'),
  ('b0000000-0000-0000-0000-00000000000b');

-- members: mA1 (login ma), mA2 (no login), mB1 (login mb)
insert into public.members (id, trainer_id, user_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Member A'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', null, 'Member A2'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000b1', 'Member B');

-- A: e1 visible to member A, e2 hidden (visible_to_member=false), e3 soft-deleted,
--    e4 member A2 (no login), e5 no member (personal). B: one event for member B.
insert into public.schedule_events (id, trainer_id, member_id, title, event_date, start_time, end_time, memo, visible_to_member, updated_at, deleted_at) values
  ('a1e00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'PT A visible', '2026-10-05', '10:00', '10:30', 'secret memo A1', true,  '2026-10-01 00:00+00', null),
  ('a1e00000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'PT A hidden',  '2026-10-06', '10:00', '10:30', 'secret memo A2', false, '2026-10-01 00:00+00', null),
  ('a1e00000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'PT A deleted', '2026-10-07', '10:00', '10:30', 'secret memo A3', true,  '2026-10-01 00:00+00', '2026-10-02 00:00+00'),
  ('a1e00000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000002', 'PT A2',        '2026-10-08', '11:00', '11:30', 'secret memo A4', true,  '2026-10-01 00:00+00', null),
  ('a1e00000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-00000000000a', null,                                   'Dentist',      '2026-10-09', '12:00', '13:00', 'personal',       true,  '2026-10-01 00:00+00', null),
  ('b1e00000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'PT B',         '2026-10-05', '10:00', '10:30', 'secret memo B',  true,  '2026-10-01 00:00+00', null);

-- ============================================================================
-- 1. schema shape
-- ============================================================================
select is(
  (select string_agg(tgname::text, ',' order by tgname::text) from pg_trigger
   where tgrelid = 'public.schedule_events'::regclass and not tgisinternal),
  'trg_evt_2_write', 'schedule_events has exactly the one write trigger');
select is(
  (select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'member_schedule'),
  'id,event_date,start_time,end_time,status,title', 'member_schedule exposes exactly 6 columns (no memo)');
select is(
  (select count(*)::int from pg_class where relnamespace = 'public'::regnamespace
     and relname in ('schedule_enrollments', 'schedule_lessons', 'schedule_signatures')),
  0, 'signature / enrollment / lesson tables do not exist');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'members' and column_name = 'program'),
  0, 'members.program does not exist');
select is(
  (select string_agg(column_name::text, ',' order by column_name::text) from information_schema.columns
   where table_schema = 'public' and table_name = 'trainers'),
  'created_at,user_id', 'trainers has only user_id and created_at');

-- ============================================================================
-- 2. anon gets nothing
-- ============================================================================
select tests.as_anon();
select throws_ok('select * from public.schedule_events', '42501', null, 'anon cannot select events');
select throws_ok('select * from public.member_schedule', '42501', null, 'anon cannot select the member view');
select throws_ok('select * from public.trainers', '42501', null, 'anon cannot select trainers');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'anon cannot insert events');

-- ============================================================================
-- 3. trainer A cannot touch trainer B's rows (select / insert / update / upsert)
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.schedule_events where trainer_id = 'b0000000-0000-0000-0000-00000000000b'), 0, 'A sees none of B events');
select is((select count(*)::int from public.schedule_events), 5, 'A sees exactly own 5 events (incl. hidden and soft-deleted)');
select is((select count(*)::int from public.trainers), 1, 'A sees only own trainers row');
select is((select count(*)::int from public.member_schedule), 0, 'A sees nothing of B (or anyone) via the member view');

select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'A cannot insert an event owned by B');
select is(tests.rows_updated($$update public.schedule_events set memo = 'hacked', updated_at = now() where id = 'b1e00000-0000-0000-0000-000000000001'$$),
          0, 'A update of B event matches 0 rows');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at)
    values ('b1e00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2026-11-01', '09:00', '09:30', now())
    on conflict (id) do update set memo = 'overwritten', trainer_id = excluded.trainer_id$$,
  '42501', null, 'A cannot upsert over B event');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, member_id, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'A cannot link B member to an event');
select throws_ok(
  $$update public.schedule_events set member_id = 'b1000000-0000-0000-0000-000000000001', updated_at = now()
    where id = 'a1e00000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A cannot re-point own event to B member');
select lives_ok(
  $$update public.schedule_events set trainer_id = 'b0000000-0000-0000-0000-00000000000b', updated_at = now()
    where id = 'a1e00000-0000-0000-0000-000000000001'$$,
  'A trying to hand own event to B is accepted but the trigger pins the owner');
select is((select trainer_id from public.schedule_events where id = 'a1e00000-0000-0000-0000-000000000001'),
          'a0000000-0000-0000-0000-00000000000a'::uuid, 'the event still belongs to A');

-- trainers rows are admin-managed
select throws_ok($$update public.trainers set user_id = 'b0000000-0000-0000-0000-00000000000b' where user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'authenticated cannot update trainers rows');
select throws_ok($$insert into public.trainers (user_id) values ('c0000000-0000-0000-0000-0000000000c0')$$,
                 '42501', null, 'authenticated cannot create trainers rows');

-- no hard delete / truncate
select throws_ok($$delete from public.schedule_events where id = 'a1e00000-0000-0000-0000-000000000002'$$,
                 '42501', null, 'authenticated cannot hard-delete events');
select throws_ok($$truncate public.schedule_events$$,
                 '42501', null, 'authenticated cannot truncate events');

-- happy path for A
select lives_ok(
  $$insert into public.schedule_events (id, trainer_id, member_id, title, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000002', 'ok', '2026-11-01', '09:00', '09:30', now())$$,
  'A can insert an event for own member');
select lives_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at)
    values ('a1e00000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000a', '2026-11-02', '09:00', '09:30', now())
    on conflict (id) do update set memo = 'upsert ok'$$,
  'A can upsert own event');
select lives_ok(
  $$update public.schedule_events set deleted_at = now(), updated_at = now() where id = 'a1e00000-0000-0000-0000-0000000000f1'$$,
  'A can soft-delete own event');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, status, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', '2026-11-03', '09:00', '09:30', 'bogus', now())$$,
  '23514', null, 'status only allows scheduled / done / cancelled');

-- ============================================================================
-- 4. authenticated user without a trainers row is not a trainer
-- ============================================================================
select tests.as_user('c0000000-0000-0000-0000-0000000000c0');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'c0000000-0000-0000-0000-0000000000c0', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'non-trainer cannot insert even with own trainer_id');
select is((select count(*)::int from public.schedule_events), 0, 'non-trainer sees no events in the base table');
select is((select count(*)::int from public.member_schedule), 0, 'non-trainer, non-member sees nothing in the view');

-- ============================================================================
-- 5. member view: only own visible, non-deleted events; memo unreachable
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.member_schedule), 1, 'member A sees exactly 1 event');
select is((select title from public.member_schedule), 'PT A visible', 'and it is the visible, non-deleted one');
select is((select count(*)::int from public.member_schedule
           where id in ('a1e00000-0000-0000-0000-000000000002', 'a1e00000-0000-0000-0000-000000000003',
                        'a1e00000-0000-0000-0000-000000000004', 'a1e00000-0000-0000-0000-000000000005',
                        'b1e00000-0000-0000-0000-000000000001')),
          0, 'hidden, deleted, other-member, personal and other-trainer events are absent');
select throws_ok('select memo from public.member_schedule', '42703', null, 'view has no memo column');
select throws_ok('select trainer_id from public.member_schedule', '42703', null, 'view has no trainer_id column');
select throws_ok('select server_updated_at from public.member_schedule', '42703', null, 'view has no server_updated_at column');
select is((select count(*)::int from public.schedule_events), 0, 'base table returns no rows to a member (no policy)');
select is((select count(memo)::int from public.schedule_events), 0, 'memo is unreachable through the base table');
select throws_ok(
  $$insert into public.schedule_events (id, trainer_id, member_id, event_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'member cannot insert events');
select is(tests.rows_updated($$update public.schedule_events set title = 'x', updated_at = now()$$),
          0, 'member cannot update events');
select throws_ok($$update public.member_schedule set title = 'x'$$, '55000', null, 'the view is not writable');
select throws_ok($$delete from public.schedule_events$$, '42501', null, 'member cannot delete events');

select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.member_schedule), 1, 'member B sees only own event');
select is((select title from public.member_schedule), 'PT B', 'and it is B''s');

-- member A2 has no login: nobody sees event 4 via the view; the trainer still has it
select tests.as_admin();
select is((select count(*)::int from public.member_schedule), 0, 'view without a JWT subject returns nothing');

-- hiding / un-hiding / deleting an event changes what the member sees
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$update public.schedule_events set visible_to_member = true, updated_at = now() where id = 'a1e00000-0000-0000-0000-000000000002'$$,
  'trainer un-hides an event');
select tests.as_user('a0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.member_schedule), 2, 'member A now sees the un-hidden event');
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$update public.schedule_events set deleted_at = now(), updated_at = now() where id = 'a1e00000-0000-0000-0000-000000000002'$$,
  'trainer soft-deletes it');
select tests.as_user('a0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.member_schedule), 1, 'member A no longer sees the soft-deleted event');

-- ============================================================================
-- 6. write trigger: stale ignored, trainer_id immutable, server stamp, clock clamp
-- ============================================================================
select tests.as_admin();
insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, memo, updated_at) values
  ('a1e00000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-00000000000a', '2026-12-01', '09:00', '09:30', 'v1', '2026-01-02 00:00+00');

update public.schedule_events set memo = 'stale', updated_at = '2026-01-01 00:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v1', 'stale write (older updated_at) is ignored');

create temp table t_stamp as
  select server_updated_at s1 from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1';
select pg_sleep(0.01);
update public.schedule_events set memo = 'v2', updated_at = '2026-01-03 00:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v2', 'newer write is applied');
select ok((select server_updated_at from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1') > (select s1 from t_stamp),
          'server_updated_at advances on a real change');

create temp table t_stamp2 as
  select server_updated_at s2 from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1';
update public.schedule_events set memo = 'v3', updated_at = '2026-01-02 12:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v2', 'stale write does not apply');
select is((select server_updated_at from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'),
          (select s2 from t_stamp2), 'stale write does not advance server_updated_at either');

update public.schedule_events set trainer_id = 'b0000000-0000-0000-0000-00000000000b', memo = 'v4', updated_at = '2026-01-04 00:00+00'
  where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select trainer_id from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'),
          'a0000000-0000-0000-0000-00000000000a'::uuid, 'trainer_id cannot change (even for the table owner)');
select is((select memo from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v4', 'other fields of that update still applied');

insert into public.schedule_events (id, trainer_id, event_date, start_time, end_time, updated_at) values
  ('a1e00000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-00000000000a', '2026-12-05', '09:00', '09:30', now() + interval '2 days');
select ok((select updated_at from public.schedule_events where id = 'a1e00000-0000-0000-0000-0000000000d2') < now() + interval '1 hour',
          'future updated_at is clamped to server time');

-- ============================================================================
-- 7. deleting a member keeps events (member_id set null)
-- ============================================================================
create temp table t_before as select count(*) n from public.schedule_events;
delete from public.members where id = 'a1000000-0000-0000-0000-000000000001';
select is((select count(*) from public.schedule_events), (select n from t_before), 'member delete keeps all events');
select is((select member_id from public.schedule_events where id = 'a1e00000-0000-0000-0000-000000000001'), null::uuid, 'event member_id set to null');

-- ============================================================================
-- 8. existing policies on members / session_logs still behave
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.members), 1, 'trainer A sees only own remaining member (A2); member A was deleted');
select lives_ok(
  $$insert into public.session_logs (member_id, session_date) values ('a1000000-0000-0000-0000-000000000002', '2026-10-05')$$,
  'trainer A can log a session for own member');
select throws_ok(
  $$insert into public.session_logs (member_id, session_date) values ('b1000000-0000-0000-0000-000000000001', '2026-10-05')$$,
  '42501', null, 'trainer A cannot log a session for B member');

select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.members), 1, 'member B sees only own members row');
select is(tests.rows_updated($$update public.members set goal = 'x' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$),
          1, 'member B can still update own members row');

select tests.as_anon();
select is((select count(*)::int from public.members), 0, 'anon sees no members rows (policy-level, as before)');

-- members self-update guard
select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$update public.members set trainer_id = 'a0000000-0000-0000-0000-00000000000a' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', 'only the managing trainer can change id, trainer_id, user_id, is_demo_protected or created_at',
  'member cannot change own trainer_id');
select throws_ok(
  $$update public.members set user_id = 'c0000000-0000-0000-0000-0000000000c0' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'member cannot change own user_id');
select throws_ok(
  $$update public.members set is_demo_protected = true where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'member cannot change own is_demo_protected');
select lives_ok(
  $$update public.members set deletion_requested_at = now(), password_set_at = now(), birth_date = '1990-01-01', gender = 'female'
    where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  'member can still update password_set_at, deletion_requested_at, birth_date, gender');
select is(tests.rows_updated($$update public.members set goal = 'strength' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$),
          1, 'member self-service update still matches the own row');

select tests.as_user('b0000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$update public.members set name = 'Member B renamed' where id = 'b1000000-0000-0000-0000-000000000001'$$,
  'managing trainer can still change the name of own member');
select throws_ok(
  $$update public.members set user_id = null where id = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', 'user_id can only be changed by service_role', 'managing trainer cannot change user_id');
select throws_ok(
  $$update public.members set trainer_id = 'a0000000-0000-0000-0000-00000000000a' where id = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'trainer cannot hand a member to another trainer (RLS)');

select tests.as_service();
select lives_ok(
  $$update public.members set trainer_id = 'b0000000-0000-0000-0000-00000000000b' where id = 'a1000000-0000-0000-0000-000000000002'$$,
  'service_role is not restricted by the guard');
select tests.as_admin();

-- ============================================================================
-- 9. unneeded table privileges are gone
-- ============================================================================
select is((select count(*)::int from pg_class c, unnest(array['anon','authenticated']) r, unnest(array['TRUNCATE','TRIGGER','REFERENCES']) p
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege(r, c.oid, p)),
          0, 'anon/authenticated have no TRUNCATE, TRIGGER or REFERENCES on any public table');
select is((select string_agg(c.relname::text || ':' || p, ',' order by c.relname::text, p)
           from pg_class c, unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('anon', c.oid, p)),
          'exercise_library:SELECT,members:SELECT,routines:SELECT', 'anon keeps only SELECT on the three keep-alive tables');
select ok(has_table_privilege('authenticated', 'public.members', 'UPDATE') and has_table_privilege('authenticated', 'public.session_logs', 'DELETE'),
          'authenticated keeps the DML privileges the app uses');
select tests.as_anon();
select throws_ok('select * from public.questionnaires', '42501', null, 'anon is denied on tables outside the keep-alive set');
select tests.as_admin();

-- ============================================================================
-- 10. user_id on members: only service_role may change it
-- ============================================================================
select tests.as_admin();
insert into public.members (id, trainer_id, user_id, name) values
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c0', 'Linked member');

select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.members set user_id = 'b0000000-0000-0000-0000-00000000000b' where id = 'a1000000-0000-0000-0000-000000000003'$$,
  '42501', 'user_id can only be changed by service_role', 'trainer cannot point user_id at another trainer');
select throws_ok(
  $$update public.members set user_id = gen_random_uuid() where id = 'a1000000-0000-0000-0000-000000000003'$$,
  '42501', 'user_id can only be changed by service_role', 'trainer cannot point user_id at a random uuid');
select throws_ok(
  $$update public.members set user_id = null where id = 'a1000000-0000-0000-0000-000000000003'$$,
  '42501', 'user_id can only be changed by service_role', 'trainer cannot clear user_id');

select tests.as_service();
select lives_ok(
  $$update public.members set user_id = null where id = 'a1000000-0000-0000-0000-000000000003'$$,
  'service_role can still change user_id');
select tests.as_admin();

-- ============================================================================
-- 11. members INSERT: only registered trainers, only for themselves
-- ============================================================================
select tests.as_user('c0000000-0000-0000-0000-0000000000c0');
select throws_ok(
  $$insert into public.members (trainer_id, name) values ('c0000000-0000-0000-0000-0000000000c0', 'Self-made member')$$,
  '42501', null, 'logged-in non-trainer cannot insert a member (even with own trainer_id)');

select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$insert into public.members (trainer_id, name) values ('b0000000-0000-0000-0000-0000000000b1', 'Member-made member')$$,
  '42501', null, 'a member login cannot insert a member');

select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.members (trainer_id, name) values ('b0000000-0000-0000-0000-00000000000b', 'Stolen slot')$$,
  '42501', null, 'trainer cannot insert a member for another trainer');
select lives_ok(
  $$insert into public.members (trainer_id, name) values ('a0000000-0000-0000-0000-00000000000a', 'New member')$$,
  'trainer can still insert their own member');
select is((select count(*)::int from public.members where name = 'New member'), 1, 'the inserted member is visible to the trainer');
select throws_ok(
  $$insert into public.members (trainer_id, name, user_id) values ('a0000000-0000-0000-0000-00000000000a', 'Pre-linked', 'c0000000-0000-0000-0000-0000000000c0')$$,
  '42501', null, 'trainer cannot insert a member that already carries a user_id');
select lives_ok(
  $$insert into public.members (trainer_id, name, user_id) values ('a0000000-0000-0000-0000-00000000000a', 'Explicit null link', null)$$,
  'trainer can insert a member with user_id NULL');
select tests.as_service();
select lives_ok(
  $$insert into public.members (trainer_id, name, user_id) values ('a0000000-0000-0000-0000-00000000000a', 'Invited member', 'c0000000-0000-0000-0000-0000000000c0')$$,
  'service_role can insert a member with user_id (the invite flow)');

select tests.as_anon();
select throws_ok(
  $$insert into public.members (trainer_id, name) values ('a0000000-0000-0000-0000-00000000000a', 'Anon made')$$,
  '42501', null, 'anon cannot insert a member');

-- ============================================================================
-- 12. default privileges: new objects created by postgres get nothing for anon/authenticated
-- ============================================================================
select tests.as_admin();
create table public.zz_default_priv (id int generated always as identity primary key);
create function public.zz_default_priv_fn() returns int language sql as 'select 1';

select is((select count(*)::int from unnest(array['anon','authenticated']) r,
             unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
           where has_table_privilege(r, 'public.zz_default_priv', p)),
          0, 'new table: no privileges for anon/authenticated');
select is((select count(*)::int from unnest(array['anon','authenticated']) r,
             unnest(array['USAGE','SELECT','UPDATE']) p
           where has_sequence_privilege(r, 'public.zz_default_priv_id_seq', p)),
          0, 'new sequence: no privileges for anon/authenticated');
select is((select count(*)::int from unnest(array['anon','authenticated']) r
           where has_function_privilege(r, 'public.zz_default_priv_fn()', 'EXECUTE')),
          0, 'new function: no EXECUTE for anon/authenticated');
select ok(has_table_privilege('service_role', 'public.zz_default_priv', 'SELECT'),
          'service_role keeps access to new tables');
select tests.as_anon();
select lives_ok('select 1 from public.exercise_library limit 1',
                'intentional anon SELECT on the keep-alive tables still works');
select tests.as_admin();

select * from finish();
rollback;
