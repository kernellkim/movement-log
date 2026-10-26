-- Close the INSERT hole fully: a logged-in user (trainers included) may not create a
-- members row that already carries a user_id. Linking a login to a member is a
-- service_role-only action (app/api/members/invite/route.ts), exactly like changing
-- user_id later (20261026000800). service_role bypasses RLS and is unaffected.

alter policy members_insert_requires_trainer on public.members
  with check (
    private.is_trainer()
    and trainer_id = (select auth.uid())
    and user_id is null
  );
