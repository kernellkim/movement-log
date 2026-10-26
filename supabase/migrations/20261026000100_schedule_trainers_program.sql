-- Schedule integration, step 1a: explicit trainer role + member program.
-- members needed no constraint changes for apartment residents:
-- user_id is already nullable and there is no email column or unique/check on identity.

create table public.trainers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instructor_name text not null default '',
  class_label text not null default '',
  household_colors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.members
  add column program text not null default 'pt' check (program in ('pt', 'apartment'));

-- Role check used by the schedule policies. Security definer so it works regardless
-- of the caller's own access to trainers; execute is limited to authenticated.
create or replace function private.is_trainer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trainers where user_id = (select auth.uid()))
$$;
revoke all on function private.is_trainer() from public;
grant execute on function private.is_trainer() to authenticated;

alter table public.trainers enable row level security;

-- Trainers can read and edit their own settings row only. Rows are created by an
-- admin (service role), so there is no INSERT/DELETE grant for authenticated.
revoke all on public.trainers from anon, authenticated;
grant select, update on public.trainers to authenticated;

create policy trainers_self_read on public.trainers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy trainers_self_update on public.trainers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
