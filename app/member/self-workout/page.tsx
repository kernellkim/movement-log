import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SelfWorkoutList } from "@/components/self-workout-list";
import { getSelfWorkoutAccess, todayKst } from "@/lib/self-workout";
import {
  loadAllowedExercises,
  loadRecentTraining,
} from "@/lib/self-workout-history";
import type { Questionnaire, SelfWorkoutLog } from "@/lib/types";
import { SelfWorkoutForm, type SessionTemplate } from "./self-workout-form";
import { DeleteSelfWorkoutButton } from "./delete-self-workout-button";

type PastSession = {
  id: string;
  session_date: string;
  session_log_items: {
    exercise_id: string | null;
    sets: number | null;
    reps: number | null;
    duration_seconds: number | null;
    weight_kg: number | null;
  }[];
};

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
  const access = getSelfWorkoutAccess(
    questionnaire?.risk_level,
    Boolean(questionnaire),
  );

  const [exercises, recent, { data: logs }] = await Promise.all([
    access.allowed
      ? loadAllowedExercises(supabase, member.id, access.weighted)
      : Promise.resolve([]),
    access.allowed
      ? loadRecentTraining(supabase, member.id)
      : Promise.resolve({ recentCategories: [], summaryText: "" }),
    supabase
      .from("self_workout_logs")
      .select("*, self_workout_items(*)")
      .eq("member_id", member.id)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<SelfWorkoutLog[]>(),
  ]);

  // 지난 수업에서 한 운동 구성을 불러와 시작할 수 있게 최근 수업 기록을 템플릿으로 넘긴다.
  const { data: pastSessions } = access.allowed
    ? await supabase
        .from("session_logs")
        .select(
          "id, session_date, session_log_items(exercise_id, sets, reps, duration_seconds, weight_kg)",
        )
        .eq("member_id", member.id)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<PastSession[]>()
    : { data: [] as PastSession[] };

  // 최근 이틀 안에 쓴 부위를 뺀 나머지를 오늘의 추천 부위로 보여준다.
  const poolCategories = Array.from(
    new Set(exercises.map((e) => e.category).filter(Boolean) as string[]),
  );
  const rested = poolCategories.filter(
    (c) => !recent.recentCategories.includes(c),
  );
  const recommendedCategories = rested.length ? rested : poolCategories;

  const allowedIds = new Set(exercises.map((e) => e.id));
  const templates: SessionTemplate[] = (pastSessions ?? [])
    .map((session) => {
      const all = (session.session_log_items ?? []).filter(
        (i) => i.exercise_id,
      );
      const items = all
        .filter((i) => allowedIds.has(i.exercise_id as string))
        .map((i) => ({
          exerciseId: i.exercise_id as string,
          sets: i.sets,
          reps: i.reps,
          durationSeconds: i.duration_seconds,
          weightKg: i.weight_kg,
        }));
      return {
        id: session.id,
        date: session.session_date,
        items,
        excluded: all.length - items.length,
      };
    })
    .filter((t) => t.items.length > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href="/member" />}
      >
        ← 홈
      </Button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          개인 운동 기록
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          PT가 없는 날 혼자 한 운동을 남겨 두면 담당 트레이너도 확인할 수
          있어요.
        </p>
      </div>

      <p className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        이 정보는 의학적 진단이 아니며, 통증이나 이상 증상이 있으면 즉시 운동을
        중단하고 담당 트레이너·의료진과 상담해 주세요.
      </p>

      {access.allowed && access.highRisk && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          ⚠️ 의료진 상담을 권장드립니다. 건강 상태를 고려해 맨몸·밴드 중심의
          안전한 운동만 고를 수 있어요. 운동 전 담당 트레이너와 상담해 주세요.
        </p>
      )}

      {access.allowed ? (
        <SelfWorkoutForm
          exercises={exercises}
          templates={templates}
          highRisk={access.highRisk}
          recentCategories={recent.recentCategories}
          recommendedCategories={recommendedCategories}
          today={todayKst()}
        />
      ) : (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          문진표를 먼저 작성해야 개인 운동을 기록할 수 있어요.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          내가 기록한 운동
        </h2>
        <SelfWorkoutList
          logs={logs ?? []}
          emptyText="아직 기록한 개인 운동이 없어요."
          renderActions={(log) => (
            <DeleteSelfWorkoutButton
              logId={log.id}
              dateLabel={log.workout_date}
            />
          )}
        />
      </div>
    </div>
  );
}
