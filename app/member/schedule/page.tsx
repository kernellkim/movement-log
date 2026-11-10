import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayKo, hhmm } from "@/lib/schedule";
import {
  MEMBER_SCHEDULE_COLUMNS,
  defaultRange,
  groupForMember,
  statusLabel,
  todayKst,
  type DayGroup,
  type MemberScheduleEvent,
} from "@/lib/member-schedule";

const STATUS_VARIANT = { scheduled: "info", done: "riskLow", cancelled: "outline" } as const;

function DayCard({ day, today }: { day: DayGroup; today: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {formatDayKo(day.date)}
          {day.date === today && (
            <span className="ml-2 text-xs font-normal text-primary">오늘</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {day.events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {hhmm(ev.start_time)} ~ {hhmm(ev.end_time)}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[ev.status]}>{statusLabel(ev.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function MemberSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  const today = todayKst();
  const { from, to } = defaultRange(today);

  // Read-only: the member_schedule view already limits rows to this member's visible,
  // non-deleted events and exposes no memo / trainer_id / member_id.
  const { data, error } = await supabase
    .from("member_schedule")
    .select(MEMBER_SCHEDULE_COLUMNS)
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .returns<MemberScheduleEvent[]>();

  const { upcoming, past } = groupForMember(data ?? [], today);
  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/member" />}>
        ← 홈
      </Button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">내 일정</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          트레이너가 공유한 수업 일정을 확인할 수 있어요. (최근 7일 ~ 앞으로 60일)
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-destructive">
              일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              아직 트레이너가 공유한 일정이 없어요. 트레이너가 일정을 등록하면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">다가오는 일정</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 일정이 없어요.</p>
            ) : (
              upcoming.map((d) => <DayCard key={d.date} day={d} today={today} />)
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">최근 지난 일정</h2>
              {past.map((d) => (
                <DayCard key={d.date} day={d} today={today} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
