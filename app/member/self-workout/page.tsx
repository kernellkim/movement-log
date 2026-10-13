import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SelfWorkoutList } from "@/components/self-workout-list";
import {
  filterExercisesForSelfWorkout,
  getSelfWorkoutAccess,
  todayKst,
} from "@/lib/self-workout";
import type { Exercise, Questionnaire, SelfWorkoutLog } from "@/lib/types";
import { SelfWorkoutForm } from "./self-workout-form";
import { DeleteSelfWorkoutButton } from "./delete-self-workout-button";

export default async function SelfWorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("risk_level")
    .eq("member_id", member.id)
    .eq("is_latest", true)
    .maybeSingle<Pick<Questionnaire, "risk_level">>();
  const access = getSelfWorkoutAccess(questionnaire?.risk_level, Boolean(questionnaire));

  const [{ data: allExercises }, { data: logs }] = await Promise.all([
    access.allowed
      ? supabase.from("exercise_library").select("*").order("name_ko").returns<Exercise[]>()
      : Promise.resolve({ data: [] as Exercise[] }),
    supabase
      .from("self_workout_logs")
      .select("*, self_workout_items(*)")
      .eq("member_id", member.id)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<SelfWorkoutLog[]>(),
  ]);

  const exercises = access.allowed
    ? filterExercisesForSelfWorkout(allExercises ?? [], access.weighted)
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/member" />}>
        ← 홈
      </Button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">자율 운동 기록</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          PT가 없는 날 혼자 한 운동을 남겨 두면 담당 트레이너도 확인할 수 있어요.
        </p>
      </div>

      <p className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        이 정보는 의학적 진단이 아니며, 통증이나 이상 증상이 있으면 즉시 운동을 중단하고
        담당 트레이너·의료진과 상담해 주세요.
      </p>

      {access.allowed ? (
        <SelfWorkoutForm exercises={exercises} today={todayKst()} />
      ) : (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {access.reason === "no_questionnaire"
            ? "문진표를 먼저 작성해야 자율 운동을 기록할 수 있어요."
            : "건강 상태상 의료진 상담이 먼저 필요해요. 담당 트레이너와 상담한 뒤 이용해 주세요."}
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">내가 기록한 운동</h2>
        <SelfWorkoutList
          logs={logs ?? []}
          emptyText="아직 기록한 자율 운동이 없어요."
          renderActions={(log) => (
            <DeleteSelfWorkoutButton logId={log.id} dateLabel={log.workout_date} />
          )}
        />
      </div>
    </div>
  );
}
