-- Stop Supabase's default "grant everything to anon/authenticated" on FUTURE objects
-- created by `postgres`. Existing objects are untouched (so the intentional anon SELECT
-- on exercise_library/members/routines for /api/health keeps working).
--
-- Covered: tables, sequences and functions created by the role `postgres` in schema
-- public. `postgres` is the role that runs migrations (supabase db push / db reset) and
-- the Dashboard SQL editor, in production and locally, and it owns all current objects.
-- NOT covered: objects created by `supabase_admin` (Supabase internals, extension
-- installs). They keep Supabase's default grants, and `postgres` is not allowed to alter
-- supabase_admin's defaults.
--
-- Consequence: every new table/sequence/function now needs explicit GRANTs in its
-- migration (the schedule migrations already do). service_role and postgres keep access.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- Functions also get EXECUTE for PUBLIC (which includes anon/authenticated) from
-- Postgres' global default; an in-schema revoke cannot remove that, so revoke it globally
-- for objects created by postgres. Effect on existing functions: none.
alter default privileges for role postgres
  revoke execute on functions from public;
