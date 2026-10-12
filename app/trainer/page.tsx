import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { Member, Questionnaire, Routine } from "@/lib/types";
import { SessionCompletedDialog } from "./session-completed-dialog";
import { DeleteMemberButton } from "./delete-member-button";

const RISK_LABEL: Record<string, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};

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

  // These 4 queries only depend on memberIds, not on each other, so run them
  // concurrently instead of one after another.
  const [
    { data: questionnaires },
    { data: activeRoutines },
    { data: bodyCompositions },
    { data: sessionLogs },
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
      : Promise.resolve({ data: [] as Pick<Routine, "member_id" | "created_at">[] }),
    memberIds.length
      ? supabase
          .from("body_composition_records")
          .select("member_id, created_at")
          .in("member_id", memberIds)
          .eq("is_latest", true)
          .returns<{ member_id: string; created_at: string }[]>()
      : Promise.resolve({ data: [] as { member_id: string; created_at: string }[] }),
    memberIds.length
      ? supabase
          .from("session_logs")
          .select("member_id, created_at")
          .in("member_id", memberIds)
          .returns<{ member_id: string; created_at: string }[]>()
      : Promise.resolve({ data: [] as { member_id: string; created_at: string }[] }),
  ]);

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

  const joinedByMember = new Map<string, boolean>();
  for (const m of members ?? []) {
    joinedByMember.set(m.id, Boolean(m.password_set_at));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <SessionCompletedDialog show={sessionCompleted === "1"} />
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">담당 회원</h1>
        <div className="flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/trainer/members/new" />}>
            새 회원 추가
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>

      <div className="space-y-3">
        {(members ?? []).length === 0 && (
          <Card className="px-4 py-6">
            <p className="text-sm text-muted-foreground">담당 회원이 없습니다.</p>
          </Card>
        )}
        {(members ?? []).map((member) => {
          const questionnaire = riskByMember.get(member.id);
          const risk = questionnaire?.risk_level;
          const joined = joinedByMember.get(member.id);
          const lastSessionAt = lastSessionAtByMember.get(member.id);
          const activeCount = activeRoutineCountByMember.get(member.id) ?? 0;
          const latestRoutineCreatedAt = latestActiveRoutineCreatedAtByMember.get(member.id);
          const latestBodyCompositionCreatedAt =
            latestBodyCompositionCreatedAtByMember.get(member.id);
          // 활성 루틴이 있어도, 그 루틴을 만든 이후 인바디가 새로
          // 갱신됐다면 문진표 갱신과 동일하게 재검사부터 다시 진행한다.
          const needsReassessment = Boolean(
            latestRoutineCreatedAt &&
              latestBodyCompositionCreatedAt &&
              latestBodyCompositionCreatedAt > latestRoutineCreatedAt,
          );
          return (
            <Card
              key={member.id}
              className="flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.name ?? "이름 없음"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  마지막 진행: {lastSessionAt ? formatDateTime(lastSessionAt) : "아직 진행 안 함"}
                </p>
                {risk === "high" && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    ⚠️ 의료진 상담 권장 대상입니다
                  </p>
                )}
                {risk && (activeCount === 0 || needsReassessment) && (
                  <p className="mt-1 text-xs font-medium text-amber-400">
                    🔔 건강정보 업데이트 - 재검토 필요
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={joined ? "info" : "outline"}>
                  {joined ? "가입완료" : "초대됨"}
                </Badge>
                <Badge
                  variant={
                    risk === "high"
                      ? "riskHigh"
                      : risk === "mid"
                        ? "riskMid"
                        : risk === "low"
                          ? "riskLow"
                          : "outline"
                  }
                  render={
                    risk ? (
                      <Link href={`/trainer/members/${member.id}/questionnaire`} />
                    ) : undefined
                  }
                >
                  {risk ? RISK_LABEL[risk] : "문진표 없음"}
                </Badge>
                {(() => {
                  if (!joined) {
                    return (
                      <Button variant="outline" size="sm" disabled>
                        회원 가입 대기중
                      </Button>
                    );
                  }
                  // 활성 루틴이 1개뿐이어도 이미 그 루틴으로 수업을 한 번 이상
                  // 완료했다면, 곧장 체크리스트로 보내지 않고 루틴 선택 화면을
                  // 거치게 한다 - 다른 루틴을 새로 시작하고 싶을 수 있어서다.
                  const hasCompletedSession = lastSessionAtByMember.has(member.id);
                  const href =
                    activeCount === 0 || needsReassessment
                      ? `/trainer/members/${member.id}/body-composition`
                      : activeCount === 1 && !hasCompletedSession
                        ? `/trainer/members/${member.id}/session`
                        : `/trainer/members/${member.id}/routines`;
                  const label =
                    activeCount === 0 || needsReassessment
                      ? "검사·루틴 시작"
                      : activeCount === 1 && !hasCompletedSession
                        ? "수업 체크리스트"
                        : "루틴 선택";
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={href} />}
                    >
                      {label}
                    </Button>
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/trainer/members/${member.id}/body-composition`} />
                  }
                >
                  인바디
                </Button>
                <DeleteMemberButton memberId={member.id} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
