-- Schedule schema: RLS cross-access, triggers, FK behaviour. Fake data only.
-- Run: supabase test db
begin;
select plan(101);

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

-- ---- fixtures (fake) --------------------------------------------------------
-- users: ta/tb trainers, ma/mb member logins, nt = authenticated but not a trainer
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'ta@test.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'tb@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a1', 'ma@test.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-0000000000b1', 'mb@test.local', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-0000000000c0', 'nt@test.local', 'authenticated', 'authenticated');
insert into public.trainers (user_id, instructor_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Trainer A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Trainer B');

-- members: mA (login ma), rA (apartment resident, no login), mB (login mb)
insert into public.members (id, trainer_id, user_id, name, program) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Member A', 'pt'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', null, 'Resident A', 'apartment'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000b1', 'Member B', 'pt');

insert into public.schedule_enrollments (id, trainer_id, member_id, member_name, month, updated_at) values
  ('ae000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'Member A', '2026-10', '2026-10-01 00:00+00'),
  ('be000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'Member B', '2026-10', '2026-10-01 00:00+00');

-- A: l1 signed, l2 unsigned, l3 already soft-deleted (member mA), l4 resident
insert into public.schedule_lessons (id, trainer_id, member_id, enrollment_id, lesson_date, start_time, end_time, updated_at, deleted_at) values
  ('a1e00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', '2026-10-05', '10:00', '10:30', '2026-10-01 00:00+00', null),
  ('a1e00000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', '2026-10-06', '10:00', '10:30', '2026-10-01 00:00+00', null),
  ('a1e00000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', '2026-10-07', '10:00', '10:30', '2026-10-01 00:00+00', '2026-10-02 00:00+00'),
  ('a1e00000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000002', null, '2026-10-08', '11:00', '11:30', '2026-10-01 00:00+00', null),
  ('b1e00000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'be000000-0000-0000-0000-000000000001', '2026-10-05', '10:00', '10:30', '2026-10-01 00:00+00', null);

-- signatures: A lesson l1, A lesson l3 (deleted lesson), A enrollment, B lesson
insert into public.schedule_signatures (id, trainer_id, lesson_id, enrollment_id, path, signed_at, updated_at) values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000001', null, 'M0 0L1 1', '2026-10-05 10:30+00', '2026-10-05 10:30+00'),
  ('a5000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000003', null, 'M0 0L2 2', '2026-10-07 10:30+00', '2026-10-07 10:30+00'),
  ('a5000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', null, 'ae000000-0000-0000-0000-000000000001', 'M0 0L3 3', '2026-10-31 10:00+00', '2026-10-05 10:00+00'),
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b1e00000-0000-0000-0000-000000000001', null, 'M0 0L9 9', '2026-10-05 10:30+00', '2026-10-05 10:30+00');

-- ============================================================================
-- 1. trigger order is pinned by name (guard before write)
-- ============================================================================
select is(
  (select string_agg(tgname::text, ',' order by tgname::text) from pg_trigger
   where tgrelid = 'public.schedule_signatures'::regclass and not tgisinternal),
  'trg_sig_1_guard,trg_sig_2_write', 'signature triggers fire guard first, then write');
select is(
  (select string_agg(tgname::text, ',' order by tgname::text) from pg_trigger
   where tgrelid = 'public.schedule_lessons'::regclass and not tgisinternal),
  'trg_les_1_signed_guard,trg_les_2_write', 'lesson triggers fire signed-guard first, then write');

-- ============================================================================
-- 2. anon gets nothing
-- ============================================================================
select tests.as_anon();
select throws_ok('select * from public.schedule_lessons', '42501', null, 'anon cannot select lessons');
select throws_ok('select * from public.schedule_enrollments', '42501', null, 'anon cannot select enrollments');
select throws_ok('select * from public.schedule_signatures', '42501', null, 'anon cannot select signatures');
select throws_ok('select * from public.trainers', '42501', null, 'anon cannot select trainers');
select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'anon cannot insert lessons');

-- ============================================================================
-- 3. trainer A cannot touch trainer B's rows (select / insert / update / upsert)
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.schedule_lessons where trainer_id = 'b0000000-0000-0000-0000-00000000000b'), 0, 'A sees none of B lessons');
select is((select count(*)::int from public.schedule_enrollments where trainer_id = 'b0000000-0000-0000-0000-00000000000b'), 0, 'A sees none of B enrollments');
select is((select count(*)::int from public.schedule_signatures where trainer_id = 'b0000000-0000-0000-0000-00000000000b'), 0, 'A sees none of B signatures');
select is((select count(*)::int from public.schedule_lessons), 4, 'A sees exactly own 4 lessons (incl. soft-deleted)');
select is((select count(*)::int from public.trainers), 1, 'A sees only own trainers row');

select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'A cannot insert a lesson owned by B');
select throws_ok(
  $$insert into public.schedule_enrollments (id, trainer_id, member_name, month, updated_at)
    values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'x', '2026-11', now())$$,
  '42501', null, 'A cannot insert an enrollment owned by B');
select throws_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, path, signed_at, updated_at)
    values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'b1e00000-0000-0000-0000-000000000001', 'p', now(), now())$$,
  '42501', null, 'A cannot insert a signature owned by B');

select is(tests.rows_updated($$update public.schedule_lessons set memo = 'hacked', updated_at = now() where id = 'b1e00000-0000-0000-0000-000000000001'$$),
          0, 'A update of B lesson matches 0 rows');
select is(tests.rows_updated($$update public.schedule_enrollments set dong = 'hacked', updated_at = now() where id = 'be000000-0000-0000-0000-000000000001'$$),
          0, 'A update of B enrollment matches 0 rows');
select is(tests.rows_updated($$update public.schedule_signatures set superseded_at = now(), updated_at = now() where id = 'b5000000-0000-0000-0000-000000000001'$$),
          0, 'A update of B signature matches 0 rows');

select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at)
    values ('b1e00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2026-11-01', '09:00', '09:30', now())
    on conflict (id) do update set memo = 'overwritten', trainer_id = excluded.trainer_id$$,
  '42501', null, 'A cannot upsert over B lesson');
select throws_ok(
  $$insert into public.schedule_enrollments (id, trainer_id, member_name, month, updated_at)
    values ('be000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'x', '2026-11', now())
    on conflict (id) do update set member_name = 'overwritten', trainer_id = excluded.trainer_id$$,
  '42501', null, 'A cannot upsert over B enrollment');
select throws_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, path, signed_at, updated_at)
    values ('b5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000002', 'p', now(), now())
    on conflict (id) do update set superseded_at = now(), trainer_id = excluded.trainer_id$$,
  '42501', null, 'A cannot upsert over B signature');

-- linking someone else's member / enrollment / lesson
select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, member_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'A cannot link B member to a lesson');
select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, enrollment_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'be000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'A cannot link B enrollment to a lesson');
select throws_ok(
  $$update public.schedule_lessons set member_id = 'b1000000-0000-0000-0000-000000000001', updated_at = now()
    where id = 'a1e00000-0000-0000-0000-000000000002'$$,
  '42501', null, 'A cannot re-point own lesson to B member');
select throws_ok(
  $$insert into public.schedule_enrollments (id, trainer_id, member_id, member_name, month, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', 'x', '2026-11', now())$$,
  '42501', null, 'A cannot link B member to an enrollment');
select throws_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, path, signed_at, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'b1e00000-0000-0000-0000-000000000001', 'p', now(), now())$$,
  '42501', null, 'A cannot sign B lesson');

-- trainers row
select is(tests.rows_updated($$update public.trainers set instructor_name = 'hacked' where user_id = 'b0000000-0000-0000-0000-00000000000b'$$),
          0, 'A cannot update B trainers row');
select lives_ok($$update public.trainers set instructor_name = 'Renamed A'
                  where user_id = 'a0000000-0000-0000-0000-00000000000a'$$, 'A can update own trainers row');
select throws_ok($$update public.trainers set user_id = 'b0000000-0000-0000-0000-00000000000b'
                   where user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'A cannot hand own trainers row to B');
select throws_ok($$insert into public.trainers (user_id) values ('c0000000-0000-0000-0000-0000000000c0')$$,
                 '42501', null, 'authenticated cannot create trainers rows');

-- no hard delete / truncate
select throws_ok($$delete from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-000000000002'$$,
                 '42501', null, 'authenticated cannot hard-delete lessons');
select throws_ok($$delete from public.schedule_enrollments where id = 'ae000000-0000-0000-0000-000000000001'$$,
                 '42501', null, 'authenticated cannot hard-delete enrollments');

-- happy path for A
select lives_ok(
  $$insert into public.schedule_lessons (id, trainer_id, member_id, enrollment_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  'A can insert a lesson for own resident member (no login)');
select lives_ok(
  $$insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at)
    values ('a1e00000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000a', '2026-11-02', '09:00', '09:30', now())
    on conflict (id) do update set memo = 'upsert ok'$$,
  'A can upsert own lesson');

-- ============================================================================
-- 4. authenticated user without a trainers row is not a trainer
-- ============================================================================
select tests.as_user('c0000000-0000-0000-0000-0000000000c0');
select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'c0000000-0000-0000-0000-0000000000c0', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'non-trainer cannot insert even with own trainer_id');
select is((select count(*)::int from public.schedule_lessons), 0, 'non-trainer sees no lessons');

-- ============================================================================
-- 5. member sees only own non-deleted rows and cannot write
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.schedule_lessons), 2, 'member sees own 2 non-deleted lessons (l1, l2; not deleted l3, not B)');
select is((select count(*)::int from public.schedule_lessons where deleted_at is not null), 0, 'member never sees soft-deleted lessons');
select is((select count(*)::int from public.schedule_enrollments), 1, 'member sees own enrollment only');
select is((select count(*)::int from public.schedule_signatures), 2, 'member sees signatures of own live lesson + own enrollment (not deleted lesson, not B)');
select is((select count(*)::int from public.trainers), 0, 'member sees no trainers rows');
select throws_ok(
  $$insert into public.schedule_lessons (id, trainer_id, member_id, lesson_date, start_time, end_time, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', '2026-11-01', '09:00', '09:30', now())$$,
  '42501', null, 'member cannot insert lessons');
select throws_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, path, signed_at, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000002', 'p', now(), now())$$,
  '42501', null, 'member cannot insert signatures');
select is(tests.rows_updated($$update public.schedule_lessons set memo = 'x', updated_at = now()$$),
          0, 'member cannot update lessons');
select is(tests.rows_updated($$update public.schedule_signatures set superseded_at = now(), updated_at = now()$$),
          0, 'member cannot void signatures');
select throws_ok($$delete from public.schedule_signatures$$, '42501', null, 'member cannot delete signatures');

select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.schedule_lessons), 1, 'member B sees only own lesson');
select is((select count(*)::int from public.schedule_signatures), 1, 'member B sees only own signature');

-- ============================================================================
-- 6. signature append-only + superseded_at write-once
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.schedule_signatures set path = 'forged', updated_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  'P0001', 'signature is append-only (only superseded_at may change)', 'path cannot change');
select throws_ok(
  $$update public.schedule_signatures set snapshot_fee = 1, updated_at = now() where id = 'a5000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'signature is append-only (only superseded_at may change)', 'snapshot_fee cannot change');
select throws_ok(
  $$update public.schedule_signatures set signed_at = now(), updated_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  'P0001', 'signature is append-only (only superseded_at may change)', 'signed_at cannot change');
select throws_ok(
  $$update public.schedule_signatures set lesson_id = 'a1e00000-0000-0000-0000-000000000002', updated_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  'P0001', 'signature is append-only (only superseded_at may change)', 'lesson_id cannot change');
select throws_ok(
  $$update public.schedule_signatures set trainer_id = 'b0000000-0000-0000-0000-00000000000b', updated_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  'P0001', 'signature is append-only (only superseded_at may change)', 'trainer_id cannot be handed to B (guard fires before RLS check)');
select throws_ok($$delete from public.schedule_signatures where id = 'a5000000-0000-0000-0000-000000000001'$$,
                 '42501', null, 'authenticated cannot delete a signature (no grant)');
select tests.as_admin();
select throws_ok($$delete from public.schedule_signatures where id = 'a5000000-0000-0000-0000-000000000001'$$,
                 'P0001', 'signature cannot be deleted', 'even the table owner cannot delete a signature (trigger)');
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$update public.schedule_signatures set superseded_at = now(), updated_at = now() where id = 'a5000000-0000-0000-0000-0000000000e1'$$,
  'superseded_at can be set');
select isnt((select superseded_at from public.schedule_signatures where id = 'a5000000-0000-0000-0000-0000000000e1'),
            null, 'superseded_at persisted');
select throws_ok(
  $$update public.schedule_signatures set superseded_at = null, updated_at = now() where id = 'a5000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'signature superseded_at is write-once', 'superseded_at cannot be cleared (un-supersede)');
select throws_ok(
  $$update public.schedule_signatures set superseded_at = '2020-01-01 00:00+00', updated_at = now() where id = 'a5000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'signature superseded_at is write-once', 'superseded_at cannot be changed to another value (re-supersede)');
select lives_ok(
  $$update public.schedule_signatures set superseded_at = superseded_at, updated_at = now() where id = 'a5000000-0000-0000-0000-0000000000e1'$$,
  'writing the same superseded_at again is a harmless no-op');
select lives_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, path, signed_at, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000002', 'p', now(), now())$$,
  'A can sign own lesson');
select throws_ok(
  $$insert into public.schedule_signatures (id, trainer_id, lesson_id, enrollment_id, path, signed_at, updated_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'a1e00000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000001', 'p', now(), now())$$,
  '23514', null, 'signature must target exactly one of lesson / enrollment');

-- ============================================================================
-- 7. soft-deleting a signed lesson is rejected; unsigned works
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.schedule_lessons set deleted_at = now(), updated_at = now() where id = 'a1e00000-0000-0000-0000-000000000001'$$,
  'P0001', 'signed lesson cannot be deleted', 'signed lesson cannot be soft-deleted');
-- l2 got a signature in section 6, so use the fresh unsigned lesson l(f1)
select lives_ok(
  $$update public.schedule_lessons set deleted_at = now(), updated_at = now() where id = 'a1e00000-0000-0000-0000-0000000000f1'$$,
  'unsigned lesson can be soft-deleted');
select isnt((select deleted_at from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000f1'),
            null, 'soft delete persisted');
select tests.as_admin();
update public.schedule_signatures set superseded_at = now(), updated_at = now() where lesson_id = 'a1e00000-0000-0000-0000-000000000001';
select lives_ok(
  $$update public.schedule_lessons set deleted_at = now(), updated_at = now() where id = 'a1e00000-0000-0000-0000-000000000001'$$,
  'lesson whose only signature is superseded can be soft-deleted');

-- ============================================================================
-- 8. write trigger: stale ignored, trainer_id immutable, server stamp, clock clamp
-- ============================================================================
select tests.as_admin();
insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, memo, updated_at) values
  ('a1e00000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-00000000000a', '2026-12-01', '09:00', '09:30', 'v1', '2026-01-02 00:00+00');

update public.schedule_lessons set memo = 'stale', updated_at = '2026-01-01 00:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v1', 'stale write (older updated_at) is ignored');

create temp table t_stamp as
  select server_updated_at s1 from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1';
select pg_sleep(0.01);
update public.schedule_lessons set memo = 'v2', updated_at = '2026-01-03 00:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v2', 'newer write is applied');
select ok((select server_updated_at from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1') > (select s1 from t_stamp),
          'server_updated_at advances on a real change');

update public.schedule_lessons set memo = 'v3', updated_at = '2026-01-02 12:00+00' where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select memo from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v2', 'stale write does not advance anything either');

update public.schedule_lessons set trainer_id = 'b0000000-0000-0000-0000-00000000000b', memo = 'v4', updated_at = '2026-01-04 00:00+00'
  where id = 'a1e00000-0000-0000-0000-0000000000d1';
select is((select trainer_id from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1'),
          'a0000000-0000-0000-0000-00000000000a'::uuid, 'trainer_id cannot change (even for the table owner)');
select is((select memo from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d1'), 'v4', 'other fields of that update still applied');

insert into public.schedule_lessons (id, trainer_id, lesson_date, start_time, end_time, updated_at) values
  ('a1e00000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-00000000000a', '2026-12-05', '09:00', '09:30', now() + interval '2 days');
select ok((select updated_at from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-0000000000d2') < now() + interval '1 hour',
          'future updated_at is clamped to server time');

-- ============================================================================
-- 9. deleting a member keeps lessons / enrollments / signatures (FK set null)
-- ============================================================================
create temp table t_before as select
  (select count(*) from public.schedule_lessons) l,
  (select count(*) from public.schedule_enrollments) e,
  (select count(*) from public.schedule_signatures) s;
delete from public.members where id = 'a1000000-0000-0000-0000-000000000001';
select is((select count(*) from public.schedule_lessons), (select l from t_before), 'member delete keeps all lessons');
select is((select count(*) from public.schedule_enrollments), (select e from t_before), 'member delete keeps all enrollments');
select is((select count(*) from public.schedule_signatures), (select s from t_before), 'member delete keeps all signatures');
select is((select member_id from public.schedule_lessons where id = 'a1e00000-0000-0000-0000-000000000002'), null::uuid, 'lesson member_id set to null');
select is((select member_id from public.schedule_enrollments where id = 'ae000000-0000-0000-0000-000000000001'), null::uuid, 'enrollment member_id set to null');

-- ============================================================================
-- 10. existing policies on members / session_logs still behave
-- ============================================================================
select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.members), 1, 'trainer A sees only own remaining member (resident A); member A was deleted');
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

select tests.as_admin();
select throws_ok(
  $$insert into public.members (trainer_id, name, program) values ('a0000000-0000-0000-0000-00000000000a', 'x', 'bogus')$$,
  '23514', null, 'program only allows pt / apartment');

-- ============================================================================
-- 11. members self-update guard (member cannot change authorization columns)
-- ============================================================================
select tests.as_user('b0000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$update public.members set trainer_id = 'a0000000-0000-0000-0000-00000000000a' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', 'only the managing trainer can change id, trainer_id, user_id, program, is_demo_protected or created_at',
  'member cannot change own trainer_id');
select throws_ok(
  $$update public.members set user_id = 'c0000000-0000-0000-0000-0000000000c0' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'member cannot change own user_id');
select throws_ok(
  $$update public.members set program = 'apartment' where user_id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'member cannot change own program');
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
  $$update public.members set program = 'apartment', name = 'Member B renamed' where id = 'b1000000-0000-0000-0000-000000000001'$$,
  'managing trainer can still change program and name of own member');
select lives_ok(
  $$update public.members set user_id = null where id = 'b1000000-0000-0000-0000-000000000001'$$,
  'managing trainer can still change user_id of own member');
select throws_ok(
  $$update public.members set trainer_id = 'a0000000-0000-0000-0000-00000000000a' where id = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'trainer cannot hand a member to another trainer (RLS)');

select tests.as_user('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$update public.members set program = 'pt' where id = 'a1000000-0000-0000-0000-000000000002'$$,
  'trainer A can change program of own resident');
select lives_ok(
  $$update public.members set user_id = 'c0000000-0000-0000-0000-0000000000c0' where id = 'a1000000-0000-0000-0000-000000000002'$$,
  'trainer A can link a login to own resident');

select tests.as_service();
select lives_ok(
  $$update public.members set trainer_id = 'b0000000-0000-0000-0000-00000000000b' where id = 'a1000000-0000-0000-0000-000000000002'$$,
  'service_role is not restricted by the guard');
select tests.as_admin();

-- ============================================================================
-- 12. unneeded table privileges are gone
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

select * from finish();
rollback;
