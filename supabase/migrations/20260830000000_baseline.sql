-- Baseline of the production schema (public + private) as of 2026-10-26.
-- Reconstructed from read-only catalog queries against production (22 applied
-- migrations collapsed into one). Schema only: the 78-row exercise_library seed
-- is NOT included here.
--
-- When this lands on production, mark it as already applied instead of running it:
--   supabase migration repair --status applied 20260830000000

create schema if not exists private;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references auth.users(id),
  name text not null,
  birth_date date,
  gender text,
  height_cm numeric,
  goal text,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id),
  password_set_at timestamptz,
  is_demo_protected boolean not null default false,
  deletion_requested_at timestamptz
);

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ko text,
  category text,
  equipment text,
  video_url text,
  image_url text,
  default_caution text,
  unit_type text not null default 'reps' check (unit_type in ('reps', 'duration')),
  high_impact boolean not null default false
);

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  parq_answers jsonb,
  injury_history text,
  surgery_history text,
  chronic_condition text,
  risk_level text check (risk_level in ('low', 'mid', 'high')),
  is_latest boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  questionnaire_id uuid references public.questionnaires(id),
  recommended_items jsonb,
  created_at timestamptz not null default now()
);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  item_name text not null,
  result text check (result in ('정상', '경미한 제한', '뚜렷한 문제')),
  trainer_note text
);

create table public.body_composition_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  measured_at date not null,
  weight_kg numeric,
  body_fat_mass_kg numeric,
  skeletal_muscle_mass_kg numeric,
  is_latest boolean not null default true,
  created_at timestamptz not null default now(),
  body_fat_percentage numeric,
  basal_metabolic_rate_kcal numeric
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  assessment_id uuid references public.assessments(id),
  body_composition_id uuid references public.body_composition_records(id),
  target_categories text[],
  status text not null default 'active' check (status in ('active', 'archived')),
  ai_snapshot jsonb,
  created_at timestamptz not null default now(),
  name text,
  is_pinned boolean not null default false
);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id),
  sets integer,
  reps integer,
  caution_note text,
  sort_order integer,
  duration_seconds integer,
  weight_kg numeric
);

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  routine_id uuid references public.routines(id),
  session_date date not null default current_date,
  free_memo text,
  created_at timestamptz not null default now()
);

create table public.session_log_items (
  id uuid primary key default gen_random_uuid(),
  session_log_id uuid not null references public.session_logs(id) on delete cascade,
  routine_item_id uuid references public.routine_items(id),
  checked boolean not null default false,
  exercise_id uuid references public.exercise_library(id),
  sets integer,
  reps integer,
  duration_seconds integer,
  note text,
  weight_kg numeric
);

create table public.health_updates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms_privacy', 'sensitive_health')),
  version text not null,
  consented_at timestamptz not null default now(),
  unique (member_id, consent_type, version)
);
create index consent_records_member_id_idx on public.consent_records (member_id);

create table public.self_workout_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  workout_date date not null,
  memo text,
  created_at timestamptz not null default now()
);
create index self_workout_logs_member_date_idx
  on public.self_workout_logs (member_id, workout_date desc, created_at desc);

create table public.self_workout_items (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.self_workout_logs(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text not null,
  sets integer,
  reps integer,
  duration_seconds integer,
  weight_kg numeric,
  sort_order integer not null default 0
);
create index self_workout_items_log_idx on public.self_workout_items (log_id);

-- Helper used by most policies. private has no schema ACL (not exposed via the API).
create or replace function private.is_member_owner_or_trainer(target_member_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from members m
    where m.id = target_member_id
      and (m.trainer_id = auth.uid() or m.user_id = auth.uid())
  );
$function$;

alter table public.members enable row level security;
alter table public.exercise_library enable row level security;
alter table public.questionnaires enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_results enable row level security;
alter table public.body_composition_records enable row level security;
alter table public.routines enable row level security;
alter table public.routine_items enable row level security;
alter table public.session_logs enable row level security;
alter table public.session_log_items enable row level security;
alter table public.health_updates enable row level security;
alter table public.consent_records enable row level security;
alter table public.self_workout_logs enable row level security;
alter table public.self_workout_items enable row level security;

-- members
create policy "member reads own record" on public.members
  for select using (user_id = auth.uid());
create policy "member updates own record" on public.members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trainer manages own members" on public.members
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- exercise_library
create policy "authenticated can read exercise library" on public.exercise_library
  for select using (auth.role() = 'authenticated'::text);

-- tables keyed directly by member_id
create policy "owner or trainer access" on public.questionnaires
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));
create policy "owner or trainer access" on public.assessments
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));
create policy "owner or trainer access" on public.body_composition_records
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));
create policy "owner or trainer access" on public.routines
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));
create policy "owner or trainer access" on public.session_logs
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));
create policy "owner or trainer access" on public.health_updates
  for all using (private.is_member_owner_or_trainer(member_id))
  with check (private.is_member_owner_or_trainer(member_id));

-- child tables (one hop to the owning member)
create policy "owner or trainer access" on public.assessment_results
  for all using (exists (select 1 from assessments a
    where a.id = assessment_results.assessment_id and private.is_member_owner_or_trainer(a.member_id)))
  with check (exists (select 1 from assessments a
    where a.id = assessment_results.assessment_id and private.is_member_owner_or_trainer(a.member_id)));
create policy "owner or trainer access" on public.routine_items
  for all using (exists (select 1 from routines r
    where r.id = routine_items.routine_id and private.is_member_owner_or_trainer(r.member_id)))
  with check (exists (select 1 from routines r
    where r.id = routine_items.routine_id and private.is_member_owner_or_trainer(r.member_id)));
create policy "owner or trainer access" on public.session_log_items
  for all using (exists (select 1 from session_logs sl
    where sl.id = session_log_items.session_log_id and private.is_member_owner_or_trainer(sl.member_id)))
  with check (exists (select 1 from session_logs sl
    where sl.id = session_log_items.session_log_id and private.is_member_owner_or_trainer(sl.member_id)));

-- consent_records
create policy "member can record own consent" on public.consent_records
  for insert with check (exists (select 1 from members m
    where m.id = consent_records.member_id and m.user_id = auth.uid()));
create policy "owner or trainer can read" on public.consent_records
  for select using (private.is_member_owner_or_trainer(member_id));

-- self_workout_logs
create policy "owner or trainer can read" on public.self_workout_logs
  for select to authenticated using (private.is_member_owner_or_trainer(member_id));
create policy "owner can insert" on public.self_workout_logs
  for insert to authenticated with check (exists (select 1 from members m
    where m.id = self_workout_logs.member_id and m.user_id = (select auth.uid() as uid)));
create policy "owner can update" on public.self_workout_logs
  for update to authenticated
  using (exists (select 1 from members m
    where m.id = self_workout_logs.member_id and m.user_id = (select auth.uid() as uid)))
  with check (exists (select 1 from members m
    where m.id = self_workout_logs.member_id and m.user_id = (select auth.uid() as uid)));
create policy "owner can delete" on public.self_workout_logs
  for delete to authenticated using (exists (select 1 from members m
    where m.id = self_workout_logs.member_id and m.user_id = (select auth.uid() as uid)));

-- self_workout_items
create policy "owner or trainer can read" on public.self_workout_items
  for select to authenticated using (exists (select 1 from self_workout_logs l
    where l.id = self_workout_items.log_id and private.is_member_owner_or_trainer(l.member_id)));
create policy "owner can insert" on public.self_workout_items
  for insert to authenticated with check (exists (select 1 from self_workout_logs l
    join members m on m.id = l.member_id
    where l.id = self_workout_items.log_id and m.user_id = (select auth.uid() as uid)));
create policy "owner can update" on public.self_workout_items
  for update to authenticated
  using (exists (select 1 from self_workout_logs l join members m on m.id = l.member_id
    where l.id = self_workout_items.log_id and m.user_id = (select auth.uid() as uid)))
  with check (exists (select 1 from self_workout_logs l join members m on m.id = l.member_id
    where l.id = self_workout_items.log_id and m.user_id = (select auth.uid() as uid)));
create policy "owner can delete" on public.self_workout_items
  for delete to authenticated using (exists (select 1 from self_workout_logs l
    join members m on m.id = l.member_id
    where l.id = self_workout_items.log_id and m.user_id = (select auth.uid() as uid)));
