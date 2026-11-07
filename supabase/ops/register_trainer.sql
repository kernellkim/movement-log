-- OPS SNIPPET, NOT A MIGRATION: never applied automatically (supabase db push/reset ignore this folder).
--
-- Registers an existing trainer account in public.trainers. Idempotent: running it again
-- for the same account changes nothing. Needs the trainers table, i.e. run it AFTER
-- migration 20261028000300 has been applied (see supabase/ROLLOUT.md).
--
-- Usage (psql, one account per run):
--   psql "$DATABASE_URL" -v trainer_user_id='<auth.users.id>' -f supabase/ops/register_trainer.sql
--
-- Safety checks: the auth user must exist and must not be a member login.

\set ON_ERROR_STOP on

\if :{?trainer_user_id}
\else
  do $$ begin raise exception 'pass the trainer auth user id: -v trainer_user_id=<uuid>'; end $$;
\endif

-- result row discarded (\g /dev/null) so the user id is not echoed to the terminal
select set_config('ops.trainer_user_id', :'trainer_user_id', false) \g /dev/null

do $ops$
declare
  uid uuid := current_setting('ops.trainer_user_id')::uuid;
begin
  if not exists (select 1 from auth.users where id = uid) then
    raise exception 'no auth user with id %', uid;
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception 'user % is a member login, refusing to register as trainer', uid;
  end if;

  insert into public.trainers (user_id)
  values (uid)
  on conflict (user_id) do nothing;

  raise notice 'trainer registered (or already was)';
end
$ops$;
