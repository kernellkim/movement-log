-- Trainer calendar: one table. id is a client-generated UUID (so offline sync can be
-- added later without a schema change). updated_at is the device's edit time
-- (last-write-wins); server_updated_at is stamped by the write trigger (pull cursor).
-- member_id uses on delete set null: removing a member must never remove calendar events.
-- No hard delete anywhere: deleted_at is the soft delete.

create table public.schedule_events (
  id uuid primary key,
  trainer_id uuid not null references auth.users(id),
  member_id uuid references public.members(id) on delete set null,
  title text not null default '',
  event_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  memo text not null default '',
  visible_to_member boolean not null default true,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index schedule_events_trainer_date_idx on public.schedule_events (trainer_id, event_date);
create index schedule_events_member_idx on public.schedule_events (member_id);
create index schedule_events_pull_idx on public.schedule_events (trainer_id, server_updated_at, id);

-- Last-write-wins on the device edit time, immutable owner, server stamp, clamp of
-- device clocks that run ahead. This is the only trigger on the table; the numeric infix
-- in its name keeps the order deterministic if a guard trigger is ever added before it.
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

create trigger trg_evt_2_write before insert or update on public.schedule_events
  for each row execute function private.sched_before_write();
