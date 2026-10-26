-- A member may update their own members row (policy "member updates own record"), but
-- must not touch columns that decide who can see or manage the row. Column-level
-- privileges cannot express this because trainers and members share the
-- authenticated role, so a trigger decides by who the caller is.
--
-- Members legitimately write only: password_set_at, deletion_requested_at,
-- birth_date, gender (app/auth/set-password, app/member/actions.ts,
-- app/member/questionnaire/actions.ts). Those and the other profile columns stay open.
-- The managing trainer (old.trainer_id = caller) and service_role/owner are unrestricted.

create or replace function private.members_self_update_guard() returns trigger
language plpgsql as $$
begin
  if current_user <> 'authenticated' then
    return new;                                   -- service_role / owner tooling
  end if;
  if old.trainer_id is not distinct from (select auth.uid()) then
    return new;                                   -- managing trainer
  end if;
  if (new.id, new.trainer_id, new.user_id, new.program, new.is_demo_protected, new.created_at)
     is distinct from
     (old.id, old.trainer_id, old.user_id, old.program, old.is_demo_protected, old.created_at) then
    raise exception 'only the managing trainer can change id, trainer_id, user_id, program, is_demo_protected or created_at'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_members_self_update_guard before update on public.members
  for each row execute function private.members_self_update_guard();
