-- Two guards on public.members.
--
-- A) Self-update restriction. A member may update their own members row (policy "member
-- updates own record"), but must not touch columns that decide who can see or manage the
-- row. Column-level privileges cannot express this because trainers and members share the
-- authenticated role, so a trigger decides by who the caller is.
--   * user_id is only ever set at registration, by service_role
--     (app/api/members/invite/route.ts). authenticated/anon must never change it,
--     trainers included.
--   * The managing trainer (old.trainer_id = caller) may change everything else.
--   * Members legitimately write only: password_set_at, deletion_requested_at,
--     birth_date, gender (app/auth/set-password, app/member/actions.ts,
--     app/member/questionnaire/actions.ts). Those and the other profile columns stay open.
--   * service_role / owner tooling is unrestricted.
--
-- B) INSERT gate. Only a registered trainer (private.is_trainer()) may INSERT into
-- members, with trainer_id = their own id and no user_id (linking a login to a member is
-- service_role-only, like changing user_id later). Restrictive, so the existing
-- permissive policy "trainer manages own members" and every other policy stay untouched.
-- The app inserts members only through service_role, which bypasses RLS.

create or replace function private.members_self_update_guard() returns trigger
language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;                                   -- service_role / owner tooling
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id can only be changed by service_role'
      using errcode = '42501';
  end if;
  if old.trainer_id is not distinct from (select auth.uid()) then
    return new;                                   -- managing trainer
  end if;
  if (new.id, new.trainer_id, new.is_demo_protected, new.created_at)
     is distinct from
     (old.id, old.trainer_id, old.is_demo_protected, old.created_at) then
    raise exception 'only the managing trainer can change id, trainer_id, user_id, is_demo_protected or created_at'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_members_self_update_guard before update on public.members
  for each row execute function private.members_self_update_guard();

create policy members_insert_requires_trainer on public.members
  as restrictive
  for insert to authenticated
  with check (
    private.is_trainer()
    and trainer_id = (select auth.uid())
    and user_id is null
  );
