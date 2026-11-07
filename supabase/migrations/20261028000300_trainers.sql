-- Explicit trainer role. A user is a trainer iff they have a row here.
-- Rows are created by an admin (service role / supabase/ops/register_trainer.sql), so
-- authenticated gets SELECT only: no INSERT, no UPDATE (there is nothing to edit), no DELETE.

create table public.trainers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Role check used by the schedule policies. Security definer so it works regardless
-- of the caller's own access to trainers; execute is limited to authenticated.
create or replace function private.is_trainer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trainers where user_id = (select auth.uid()))
$$;
revoke all on function private.is_trainer() from public;
grant execute on function private.is_trainer() to authenticated;

alter table public.trainers enable row level security;

revoke all on public.trainers from anon, authenticated;
grant select on public.trainers to authenticated;

create policy trainers_self_read on public.trainers
  for select to authenticated
  using (user_id = (select auth.uid()));
