"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalActions, ModalDanger } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  WEEKDAYS_KO,
  addDays,
  addMonths,
  formatDayKo,
  groupByDate,
  hhmm,
  isMissingTableError,
  monthGrid,
  parseYmd,
  sameMonth,
  validateEvent,
  weekDays,
  type EventErrors,
  type EventStatus,
  type ScheduleEvent,
} from "@/lib/schedule";

type Member = { id: string; name: string };
type View = "month" | "week";

type Draft = {
  id: string;
  isNew: boolean;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: EventStatus;
  memo: string;
  member_id: string | null;
  visible_to_member: boolean;
};

const COLUMNS =
  "id, member_id, title, event_date, start_time, end_time, status, memo, visible_to_member";

const dotClass: Record<EventStatus, string> = {
  scheduled: "bg-primary",
  done: "bg-chart-3",
  cancelled: "bg-chart-4",
};

export function ScheduleCalendar({
  today,
  members,
}: {
  today: string;
  members: Member[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(today); // a date inside the visible month/week
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const days = useMemo(
    () => (view === "month" ? monthGrid(anchor) : weekDays(anchor)),
    [view, anchor],
  );
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("schedule_events")
        .select(COLUMNS)
        .is("deleted_at", null)
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd)
        .order("event_date")
        .order("start_time")
        .returns<ScheduleEvent[]>();
      if (cancelled) return;
      if (err) {
        setError(
          isMissingTableError(err)
            ? "스케줄 기능이 아직 이 데이터베이스에 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요."
            : "일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setEvents([]);
      } else {
        setError(null);
        setEvents(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, rangeStart, rangeEnd, reloadKey]);

  const byDate = useMemo(() => groupByDate(events), [events]);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  function go(delta: number) {
    const next = view === "month" ? addMonths(anchor, delta) : addDays(anchor, 7 * delta);
    setAnchor(next);
    setSelected(next);
  }
  function goToday() {
    setAnchor(today);
    setSelected(today);
  }

  function openNew(date: string) {
    setDraft({
      id: crypto.randomUUID(),
      isNew: true,
      title: "",
      event_date: date,
      start_time: "10:00",
      end_time: "11:00",
      status: "scheduled",
      memo: "",
      member_id: null,
      visible_to_member: true,
    });
  }
  function openEdit(ev: ScheduleEvent) {
    setDraft({
      id: ev.id,
      isNew: false,
      title: ev.title,
      event_date: ev.event_date,
      start_time: hhmm(ev.start_time),
      end_time: hhmm(ev.end_time),
      status: ev.status,
      memo: ev.memo,
      member_id: ev.member_id,
      visible_to_member: ev.visible_to_member,
    });
  }

  const { y, m0 } = parseYmd(anchor);
  const headerLabel =
    view === "month"
      ? `${y}년 ${m0 + 1}월`
      : `${formatDayKo(weekDays(anchor)[0])} ~ ${formatDayKo(weekDays(anchor)[6])}`;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name;
  const dayEvents = byDate.get(selected) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" aria-label="이전" onClick={() => go(-1)}>
            <ChevronLeft />
          </Button>
          <Button size="icon" variant="outline" aria-label="다음" onClick={() => go(1)}>
            <ChevronRight />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>
            오늘
          </Button>
        </div>
        <div className="flex gap-1">
          {(["month", "week"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
            >
              {v === "month" ? "월" : "주"}
            </Button>
          ))}
        </div>
      </div>
      <h2 className="text-lg font-semibold text-foreground">{headerLabel}</h2>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {view === "month" ? (
        <div className="rounded-xl bg-card p-2 ring-1 ring-foreground/10">
          <div className="grid grid-cols-7 pb-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS_KO.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((d) => {
              const list = byDate.get(d) ?? [];
              const inMonth = sameMonth(d, anchor);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelected(d);
                    if (!inMonth) setAnchor(d);
                  }}
                  aria-label={`${formatDayKo(d)} 일정 ${list.length}건`}
                  aria-pressed={d === selected}
                  className={cn(
                    "flex h-14 flex-col items-center gap-1 rounded-lg py-1 text-sm transition-colors hover:bg-muted",
                    !inMonth && "text-muted-foreground/50",
                    d === selected && "bg-muted ring-1 ring-ring",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      d === today && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {parseYmd(d).d}
                  </span>
                  {list.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      {list.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn("size-1.5 rounded-full", dotClass[ev.status])}
                        />
                      ))}
                      {list.length > 3 && (
                        <span className="text-[10px] leading-none text-muted-foreground">
                          +{list.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      {view === "month" ? (
        <DayList
          label={formatDayKo(selected)}
          isToday={selected === today}
          events={dayEvents}
          loading={loading}
          failed={!!error}
          memberName={memberName}
          onAdd={() => openNew(selected)}
          onEdit={openEdit}
        />
      ) : (
        <div className="space-y-5">
          {weekDays(anchor).map((d) => (
            <DayList
              key={d}
              label={formatDayKo(d)}
              isToday={d === today}
              events={byDate.get(d) ?? []}
              loading={loading}
              failed={!!error}
              memberName={memberName}
              onAdd={() => openNew(d)}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      <EventEditor
        draft={draft}
        members={members}
        supabase={supabase}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          reload();
        }}
      />
    </div>
  );
}

function DayList({
  label,
  isToday,
  events,
  loading,
  failed,
  memberName,
  onAdd,
  onEdit,
}: {
  label: string;
  isToday: boolean;
  events: ScheduleEvent[];
  loading: boolean;
  failed: boolean;
  memberName: (id: string | null) => string | undefined;
  onAdd: () => void;
  onEdit: (ev: ScheduleEvent) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {label}
          {isToday && <span className="ml-2 text-xs text-accent-foreground">오늘</span>}
        </h3>
        <Button size="sm" onClick={onAdd} disabled={failed}>
          일정 추가
        </Button>
      </div>
      {events.length === 0 ? (
        !loading && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            {failed ? "일정을 표시할 수 없습니다." : "이 날은 일정이 없습니다."}
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onEdit(ev)}
                className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted"
              >
                <span className={cn("size-2 shrink-0 rounded-full", dotClass[ev.status])} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium text-foreground",
                      ev.status === "cancelled" && "line-through opacity-60",
                    )}
                  >
                    {ev.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {hhmm(ev.start_time)} – {hhmm(ev.end_time)}
                    {memberName(ev.member_id) && ` · ${memberName(ev.member_id)}`}
                    {!ev.visible_to_member && ev.member_id && " · 회원에게 숨김"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {STATUS_LABEL[ev.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventEditor({
  draft,
  members,
  supabase,
  onClose,
  onSaved,
}: {
  draft: Draft | null;
  members: Member[];
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (draft && !dlg.open) dlg.showModal();
    if (!draft && dlg.open) dlg.close();
  }, [draft]);

  return (
    <Modal
      dialogRef={dialogRef}
      title={draft?.isNew ? "일정 추가" : "일정 수정"}
      onClose={onClose}
    >
      {draft && (
        <EditorForm
          key={draft.id}
          initial={draft}
          members={members}
          supabase={supabase}
          onCancel={() => dialogRef.current?.close()}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function EditorForm({
  initial,
  members,
  supabase,
  onCancel,
  onSaved,
}: {
  initial: Draft;
  members: Member[];
  supabase: ReturnType<typeof createClient>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<EventErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setF((cur) => ({ ...cur, [k]: v }));

  const filtered = members.filter((m) => m.name.includes(query.trim()));
  const linked = members.find((m) => m.id === f.member_id);

  function pickMember(m: Member | null) {
    setF((cur) => {
      const prev = members.find((x) => x.id === cur.member_id);
      // Prefill the title unless the trainer already typed their own.
      const titleIsAuto = !cur.title.trim() || cur.title === prev?.name;
      return {
        ...cur,
        member_id: m?.id ?? null,
        title: titleIsAuto ? (m?.name ?? "") : cur.title,
      };
    });
  }

  function describe(err: { code?: string; message?: string }) {
    if (isMissingTableError(err))
      return "스케줄 기능이 아직 이 데이터베이스에 준비되지 않았습니다.";
    if (err.code === "42501") return "이 일정을 저장할 권한이 없습니다.";
    return "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  async function save() {
    const errs = validateEvent(f);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    const now = new Date().toISOString(); // an instant (updated_at), not a calendar date
    const fields = {
      title: f.title.trim(),
      event_date: f.event_date,
      start_time: f.start_time,
      end_time: f.end_time,
      status: f.status,
      memo: f.memo,
      member_id: f.member_id,
      visible_to_member: f.visible_to_member,
      updated_at: now,
    };
    if (f.isNew) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSaving(false);
        setFormError("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      const { error } = await supabase
        .from("schedule_events")
        .insert({ id: f.id, trainer_id: auth.user.id, ...fields });
      setSaving(false);
      if (error) return setFormError(describe(error));
    } else {
      const { data, error } = await supabase
        .from("schedule_events")
        .update(fields)
        .eq("id", f.id)
        .select("id");
      setSaving(false);
      if (error) return setFormError(describe(error));
      // The write trigger silently drops edits older than what is stored.
      if (!data || data.length === 0)
        return setFormError(
          "다른 곳에서 더 최근에 수정된 일정이라 저장되지 않았습니다. 닫고 다시 열어 확인해 주세요.",
        );
    }
    onSaved();
  }

  async function remove() {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("schedule_events")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", f.id);
    if (error) return setFormError(describe(error));
    onSaved();
  }

  return (
    <div className="space-y-4">
      <Field label="제목" htmlFor="ev-title" error={errors.title}>
        <Input
          id="ev-title"
          value={f.title}
          aria-invalid={!!errors.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          제목은 연결된 회원에게 보일 수 있습니다. 회원에게 보이지 않을 내용은 메모에 적어 주세요.
        </p>
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="ev-member-q">PT 회원 연결 (선택)</Label>
        {linked ? (
          <div className="flex items-center justify-between rounded-lg border border-input px-2.5 py-1.5 text-sm">
            <span>{linked.name}</span>
            <Button type="button" size="xs" variant="ghost" onClick={() => pickMember(null)}>
              연결 해제
            </Button>
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">담당 회원이 없습니다. 개인 일정으로 저장됩니다.</p>
        ) : (
          <>
            <Input
              id="ev-member-q"
              placeholder="회원 이름 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="max-h-32 divide-y divide-border overflow-y-auto rounded-lg border border-input">
              {filtered.length === 0 && (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">검색 결과가 없습니다.</li>
              )}
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full px-2.5 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => pickMember(m)}
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Field label="날짜" htmlFor="ev-date" error={errors.event_date}>
        <Input
          id="ev-date"
          type="date"
          value={f.event_date}
          aria-invalid={!!errors.event_date}
          onChange={(e) => set("event_date", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시작" htmlFor="ev-start" error={errors.start_time}>
          <Input
            id="ev-start"
            type="time"
            value={f.start_time}
            aria-invalid={!!errors.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </Field>
        <Field label="종료" htmlFor="ev-end" error={errors.end_time}>
          <Input
            id="ev-end"
            type="time"
            value={f.end_time}
            aria-invalid={!!errors.end_time}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <Label>상태</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STATUS_LABEL) as EventStatus[]).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={f.status === s ? "default" : "outline"}
              aria-pressed={f.status === s}
              onClick={() => set("status", s)}
            >
              {STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <Field label="메모" htmlFor="ev-memo">
        <Textarea id="ev-memo" value={f.memo} onChange={(e) => set("memo", e.target.value)} />
        <p className="text-xs text-muted-foreground">메모는 회원에게 절대 보이지 않습니다.</p>
      </Field>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="ev-visible">회원에게 보이기</Label>
          <button
            id="ev-visible"
            type="button"
            role="switch"
            aria-checked={f.visible_to_member}
            onClick={() => set("visible_to_member", !f.visible_to_member)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              f.visible_to_member ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
                f.visible_to_member && "translate-x-5",
              )}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {f.member_id
            ? "켜면 연결된 회원이 이 일정의 제목과 시간을 볼 수 있습니다. 끄면 회원에게 보이지 않습니다."
            : "회원을 연결하지 않은 개인 일정은 이 스위치와 상관없이 회원에게 보이지 않습니다."}
        </p>
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <ModalActions>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" size="lg" onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </ModalActions>

      {!f.isNew && (
        <div className="flex justify-center">
          <ConfirmDialog
            triggerLabel="일정 삭제"
            title="일정을 삭제할까요?"
            items={[
              <>
                <ModalDanger>{f.title || "이 일정"}</ModalDanger> 일정이 달력에서 사라지고, 연결된
                회원에게도 보이지 않습니다.
              </>,
              "기록은 삭제 표시로만 남습니다.",
            ]}
            confirmLabel="삭제"
            confirmVariant="destructive"
            action={remove}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
