-- voided_at -> superseded_at ("replaced by a newer signature"). The old row stays as
-- history; the UI shows only the latest non-superseded signature.
-- superseded_at is write-once: NULL -> timestamp only, never cleared, never changed.
-- plpgsql bodies are not rewritten by a column rename, so both functions are replaced.

alter table public.schedule_signatures rename column voided_at to superseded_at;

comment on column public.schedule_signatures.superseded_at is
  'Set when a newer signature replaces this one. Write-once (enforced by private.sig_append_only).';

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
    raise exception 'signature is append-only (only superseded_at may change)';
  end if;
  -- write-once: re-sending the same value is a harmless no-op (sync retries)
  if old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at then
    raise exception 'signature superseded_at is write-once';
  end if;
  return new;
end $$;

create or replace function private.block_signed_lesson_delete() returns trigger
language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and exists (select 1 from public.schedule_signatures s
                 where s.lesson_id = new.id and s.superseded_at is null) then
    raise exception 'signed lesson cannot be deleted';
  end if;
  return new;
end $$;
