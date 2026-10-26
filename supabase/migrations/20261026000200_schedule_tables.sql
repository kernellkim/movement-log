-- Schedule integration, step 1b: enrollments, lessons, signatures.
-- ids are client-generated UUIDs (offline-first). updated_at is the device's edit time
-- (conflict resolution); server_updated_at is stamped by the write trigger (pull cursor).
-- member_id / enrollment_id use on delete set null: removing a member must never
-- remove lessons, enrollments or signatures (signatures are billing evidence).

create table public.schedule_enrollments (
  id uuid primary key,
  trainer_id uuid not null references auth.users(id),
  member_id uuid references public.members(id) on delete set null,
  member_name text not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  dong text not null default '',
  ho text not null default '',
  phone text not null default '',
  period_start date,
  period_end date,
  default_start time,
  default_end time,
  slots jsonb not null default '{}'::jsonb,
  applied_on date,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index schedule_enrollments_trainer_month_idx on public.schedule_enrollments (trainer_id, month);
create index schedule_enrollments_pull_idx on public.schedule_enrollments (trainer_id, server_updated_at, id);
create index schedule_enrollments_member_idx on public.schedule_enrollments (member_id);

create table public.schedule_lessons (
  id uuid primary key,
  trainer_id uuid not null references auth.users(id),
  member_id uuid references public.members(id) on delete set null,
  enrollment_id uuid references public.schedule_enrollments(id) on delete set null,
  lesson_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  memo text not null default '',
  session_log_id uuid references public.session_logs(id) on delete set null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index schedule_lessons_trainer_date_idx on public.schedule_lessons (trainer_id, lesson_date);
create index schedule_lessons_member_date_idx on public.schedule_lessons (member_id, lesson_date);
create index schedule_lessons_pull_idx on public.schedule_lessons (trainer_id, server_updated_at, id);
create index schedule_lessons_enrollment_idx on public.schedule_lessons (enrollment_id);
create index schedule_lessons_session_log_idx on public.schedule_lessons (session_log_id);

create table public.schedule_signatures (
  id uuid primary key,
  trainer_id uuid not null references auth.users(id),
  lesson_id uuid references public.schedule_lessons(id),
  enrollment_id uuid references public.schedule_enrollments(id),
  path text not null,
  signed_at timestamptz not null,
  snapshot_count int,
  snapshot_fee int,
  source text not null default 'app' check (source in ('app', 'migrated')),
  voided_at timestamptz,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  check ((lesson_id is null) <> (enrollment_id is null))  -- exactly one target
);
create index schedule_signatures_lesson_idx on public.schedule_signatures (lesson_id);
create index schedule_signatures_enrollment_idx on public.schedule_signatures (enrollment_id);
create index schedule_signatures_pull_idx on public.schedule_signatures (trainer_id, server_updated_at, id);
