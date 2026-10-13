import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberForUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { Member, Questionnaire, Routine } from "@/lib/types";
import { SessionCompletedDialog } from "./session-completed-dialog";
import { RefreshButton } from "@/components/refresh-button";
import { todayKst } from "@/lib/self-workout";
import { MemberList, type MemberRow } from "./member-list";

export default async function TrainerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sessionCompleted?: string; error?: string }>;
}) {
  const { sessionCompleted, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const asMember = await getMemberForUser(supabase, user.id);
  if (asMember) redirect("/member");

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("trainer_id", user.id)
    .returns<Member[]>();

  const memberIds = (members ?? []).map((m) => m.id);

  // 로그인 이메일은 auth.users에만 있어서 서버 전용 admin 클라이언트로 담당 회원 것만 조회한다.
  const emailByUserId = new Map<string, string>();
  const myUserIds = new Set(
    (members ?? []).map((m) => m.user_id).filter(Boolean),
  );
  if (myUserIds.size > 0) {
    try {
      const { data: authList } = await createAdminClient().auth.admin.listUsers(
        {
          perPage: 1000,
        },
      );
      for (const u of authList?.users ?? []) {
        if (myUserIds.has(u.id) && u.email) emailByUserId.set(u.id, u.email);
      }
    } catch {
      // 이메일 표시는 부가 정보라 실패해도 목록은 그대로 보여준다.
    }
  }

  // These 4 queries only depend on memberIds, not on each other, so run them
  // concurrently instead of one after another.
  const [
    { data: questionnaires },
    { data: activeRoutines },
    { data: bodyCompositions },
    { data: sessionLogs },
    { data: consentRows },
    { data: selfWorkoutRows },
  ] = await Promise.all([
    memberIds.length
      ? supabase
          .from("questionnaires")
          .select("*")
          .in("member_id", memberIds)
          .eq("is_latest", true)
          .returns<Questionnaire[]>()
      : Promise.resolve({ data: [] as Questionnaire[] }),
    memberIds.length
      ? supabase
          .from("routines")
          .select("member_id, created_at")
          .in("member_id", memberIds)
          .eq("status", "active")
          .returns<Pick<Routine, "member_id" | "created_at">[]>()
      : Promise.resolve({
          data: [] as Pick<Routine, "member_id" | "created_at">[],
        }),
    memberIds.length
      ? supabase
          .from("body_composition_records")
          .select("member_id, created_at")
          .in("member_id", memberIds)
          .eq("is_latest", true)
          .returns<{ member_id: string; created_at: string }[]>()
      : Promise.resolve({
          data: [] as { member_id: string; created_at: string }[],
        }),
    memberIds.length
      ? supabase
          .from("session_logs")
          .select("member_id, created_at")
          .in("member_id", memberIds)
          .returns<{ member_id: string; created_at: string }[]>()
      : Promise.resolve({
          data: [] as { member_id: string; created_at: string }[],
        }),
    memberIds.length
      ? supabase
          .from("consent_records")
          .select("member_id, consent_type")
          .in("member_id", memberIds)
          .returns<{ member_id: string; consent_type: string }[]>()
      : Promise.resolve({
          data: [] as { member_id: string; consent_type: string }[],
        }),
    memberIds.length
      ? supabase
          .from("self_workout_logs")
          .select("member_id, workout_date")
          .in("member_id", memberIds)
          .returns<{ member_id: string; workout_date: string }[]>()
      : Promise.resolve({
          data: [] as { member_id: string; workout_date: string }[],
        }),
  ]);

  // 개인 운동 요약: 가장 최근 날짜와 최근 7일(오늘 포함) 기록 횟수
  const weekStart = new Date(`${todayKst()}T00:00:00+09:00`);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(weekStart);
  const selfWorkoutByMember = new Map<string, { last: string; week: number }>();
  for (const row of selfWorkoutRows ?? []) {
    const cur = selfWorkoutByMember.get(row.member_id) ?? { last: "", week: 0 };
    if (row.workout_date > cur.last) cur.last = row.workout_date;
    if (row.workout_date >= weekStartStr) cur.week += 1;
    selfWorkoutByMember.set(row.member_id, cur);
  }

  const riskByMember = new Map(
    (questionnaires ?? []).map((q) => [q.member_id, q]),
  );

  const activeRoutineCountByMember = new Map<string, number>();
  const latestActiveRoutineCreatedAtByMember = new Map<string, string>();
  for (const r of activeRoutines ?? []) {
    activeRoutineCountByMember.set(
      r.member_id,
      (activeRoutineCountByMember.get(r.member_id) ?? 0) + 1,
    );
    const current = latestActiveRoutineCreatedAtByMember.get(r.member_id);
    if (!current || r.created_at > current) {
      latestActiveRoutineCreatedAtByMember.set(r.member_id, r.created_at);
    }
  }

  const latestBodyCompositionCreatedAtByMember = new Map(
    (bodyCompositions ?? []).map((b) => [b.member_id, b.created_at]),
  );

  const lastSessionAtByMember = new Map<string, string>();
  for (const log of sessionLogs ?? []) {
    const current = lastSessionAtByMember.get(log.member_id);
    if (!current || log.created_at > current) {
      lastSessionAtByMember.set(log.member_id, log.created_at);
    }
  }

  // "가입완료" = 비밀번호를 설정했고, 이용약관·개인정보 동의와 건강정보 동의를 모두
  // 한 번 이상 마친 회원. (약관 버전이 바뀌어 재동의가 필요한 회원은 이미 가입한
  // 상태이므로 여기서는 버전을 따지지 않는다.)
  const consentTypesByMember = new Map<string, Set<string>>();
  for (const c of consentRows ?? []) {
    const set = consentTypesByMember.get(c.member_id) ?? new Set<string>();
    set.add(c.consent_type);
    consentTypesByMember.set(c.member_id, set);
  }
  const joinedByMember = new Map<string, boolean>();
  for (const m of members ?? []) {
    const types = consentTypesByMember.get(m.id);
    joinedByMember.set(
      m.id,
      Boolean(m.password_set_at) &&
        Boolean(types?.has("terms_privacy") && types?.has("sensitive_health")),
    );
  }

  const rows: MemberRow[] = (members ?? []).map((member) => {
    const risk = riskByMember.get(member.id)?.risk_level ?? null;
    const activeCount = activeRoutineCountByMember.get(member.id) ?? 0;
    const latestRoutineCreatedAt = latestActiveRoutineCreatedAtByMember.get(
      member.id,
    );
    const latestBodyCompositionCreatedAt =
      latestBodyCompositionCreatedAtByMember.get(member.id);
    // 활성 루틴이 있어도, 그 루틴을 만든 이후 인바디가 새로
    // 갱신됐다면 문진표 갱신과 동일하게 재검사부터 다시 진행한다.
    const needsReassessment = Boolean(
      latestRoutineCreatedAt &&
      latestBodyCompositionCreatedAt &&
      latestBodyCompositionCreatedAt > latestRoutineCreatedAt,
    );
    // 활성 루틴이 1개뿐이어도 이미 그 루틴으로 수업을 한 번 이상 완료했다면,
    // 곧장 체크리스트로 보내지 않고 루틴 선택 화면을 거치게 한다 -
    // 다른 루틴을 새로 시작하고 싶을 수 있어서다.
    const hasCompletedSession = lastSessionAtByMember.has(member.id);
    const needsStart = activeCount === 0 || needsReassessment;
    const actionHref = needsStart
      ? `/trainer/members/${member.id}/body-composition`
      : activeCount === 1 && !hasCompletedSession
        ? `/trainer/members/${member.id}/session`
        : `/trainer/members/${member.id}/routines`;
    const actionLabel = needsStart
      ? "검사·루틴 시작"
      : activeCount === 1 && !hasCompletedSession
        ? "수업 체크리스트"
        : "루틴 선택";
    const lastSessionAt = lastSessionAtByMember.get(member.id) ?? null;
    return {
      id: member.id,
      name: member.name,
      email: (member.user_id && emailByUserId.get(member.user_id)) || null,
      risk,
      joined: Boolean(joinedByMember.get(member.id)),
      passwordSet: Boolean(member.password_set_at),
      lastSessionAt,
      lastSessionLabel: lastSessionAt ? formatDateTime(lastSessionAt) : null,
      deletionRequestedLabel: member.deletion_requested_at
        ? formatDateTime(member.deletion_requested_at)
        : null,
      selfWorkoutLabel: selfWorkoutByMember.has(member.id)
        ? `${selfWorkoutByMember.get(member.id)!.last.slice(5).replace("-", "/")} · 최근 7일 ${selfWorkoutByMember.get(member.id)!.week}회`
        : null,
      needsReview: Boolean(risk && needsStart),
      actionHref,
      actionLabel,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <SessionCompletedDialog show={sessionCompleted === "1"} />
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">담당 회원</h1>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/trainer/members/new" />}
          >
            새 회원 추가
          </Button>
          <form action={signOut} className="flex">
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>

      <MemberList members={rows} />
    </div>
  );
}
