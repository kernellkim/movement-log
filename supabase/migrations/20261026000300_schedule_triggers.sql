-- Schedule integration, step 1c: write triggers.
-- BEFORE triggers on one table fire in name order, so the numeric infix pins the order:
-- guards (reject) run first, then the write trigger (stale-ignore / stamp).

-- Last-write-wins on the device edit time (D7), immutable owner, server stamp,
-- clamp of device clocks that run ahead.
create or replace function private.sched_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;                            -- stale write: silently ignored
    end if;
    new.trainer_id := old.trainer_id;         -- owner cannot change
  end if;
  if new.updated_at > clock_timestamp() then
    new.updated_at := clock_timestamp();
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

create trigger trg_enr_2_write before insert or update on public.schedule_enrollments
  for each row execute function private.sched_before_write();
create trigger trg_les_2_write before insert or update on public.schedule_lessons
  for each row execute function private.sched_before_write();
create trigger trg_sig_2_write before insert or update on public.schedule_signatures
  for each row execute function private.sched_before_write();

-- Signatures are append-only: only voided_at may change; never deleted.
create or replace function private.sig_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'signature cannot be deleted';
  end if;
  if (new.id, new.path, new.signed_at, new.lesson_id, new.enrollment_id,
      new.snapshot_count, new.snapshot_fee, new.trainer_id, new.source)
     is distinct from
     (old.id, old.path, old.signed_at, old.lesson_id, old.enrollment_id,
      old.snapshot_count, old.snapshot_fee, old.trainer_id, old.source) then
    raise exception 'signature is append-only (only voided_at may change)';
  end if;
  return new;
end $$;

create trigger trg_sig_1_guard before update or delete on public.schedule_signatures
  for each row execute function private.sig_append_only();

-- A lesson with a non-voided signature cannot be soft-deleted.
create or replace function private.block_signed_lesson_delete() returns trigger
language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and exists (select 1 from public.schedule_signatures s
                 where s.lesson_id = new.id and s.voided_at is null) then
    raise exception 'signed lesson cannot be deleted';
  end if;
  return new;
end $$;

create trigger trg_les_1_signed_guard before update on public.schedule_lessons
  for each row execute function private.block_signed_lesson_delete();
