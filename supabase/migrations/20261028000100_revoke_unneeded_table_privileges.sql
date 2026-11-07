-- Supabase grants every privilege on new public tables to anon/authenticated. TRUNCATE
-- bypasses RLS entirely, and TRIGGER/REFERENCES are never needed by the app, so they go.
--
-- anon: the app never writes as anon. Its only anonymous reads are the keep-alive
-- pings in app/api/health/route.ts (exercise_library, members, routines; RLS returns no
-- rows for anon), so SELECT stays on exactly those three tables and nothing else.
-- authenticated keeps select/insert/update/delete: RLS decides, and the app does use them.

revoke truncate, trigger, references on all tables in schema public from authenticated;

revoke all on all tables in schema public from anon;
grant select on public.exercise_library, public.members, public.routines to anon;
