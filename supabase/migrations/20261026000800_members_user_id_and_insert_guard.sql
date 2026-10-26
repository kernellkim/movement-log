-- Hole fix A: user_id on members is only ever set at registration, by service_role
-- (app/api/members/invite/route.ts). authenticated/anon must never change it, trainers
-- included. A trigger (not a column privilege) is used because a column revoke would need
-- a re-grant for every column added to members later, and would also reject no-op writes.
-- Replaces the guard from 20261026000600 (same name, same remaining rules).
--
-- Hole fix B: only a registered trainer (private.is_trainer()) may INSERT into members,
-- with trainer_id = their own id. Restrictive, so the existing permissive policy
-- "trainer manages own members" and every other policy stay untouched.
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
  if (new.id, new.trainer_id, new.program, new.is_demo_protected, new.created_at)
     is distinct from
     (old.id, old.trainer_id, old.program, old.is_demo_protected, old.created_at) then
    raise exception 'only the managing trainer can change id, trainer_id, user_id, program, is_demo_protected or created_at'
      using errcode = '42501';
  end if;
  return new;
end $$;

create policy members_insert_requires_trainer on public.members
  as restrictive
  for insert to authenticated
  with check (private.is_trainer() and trainer_id = (select auth.uid()));
