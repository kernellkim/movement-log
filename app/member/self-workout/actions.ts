"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { needsWeightInput } from "@/lib/format";
import {
  filterExercisesForSelfWorkout,
  getSelfWorkoutAccess,
  todayKst,
} from "@/lib/self-workout";
import type { Exercise, Questionnaire } from "@/lib/types";

export type SelfWorkoutPayload = {
  date: string;
  memo: string;
  items: {
    exerciseId: string;
    sets: number | null;
    reps: number | null;
    durationSeconds: number | null;
    weightKg: number | null;
  }[];
};

type Result = { error?: string };

function inRange(n: number | null, min: number, max: number): boolean {
  return n === null || (Number.isFinite(n) && n >= min && n <= max);
}

export async function saveSelfWorkout(
  payload: SelfWorkoutPayload,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const member = await getMemberForUser(supabase, user.id);
  if (!member) return { error: "회원 계정만 기록할 수 있습니다." };

  // 안전 기준은 서버에서 다시 확인한다(화면 필터만 믿지 않는다).
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
  if (!access.allowed)
    return {
      error:
        "지금은 개인 운동을 기록할 수 없습니다. 담당 트레이너와 상담해 주세요.",
    };

  const today = todayKst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || payload.date > today) {
    return {
      error: "운동 날짜를 확인해 주세요. 오늘 이후 날짜는 기록할 수 없어요.",
    };
  }
  if (payload.items.length < 1 || payload.items.length > 30) {
    return { error: "운동을 1개 이상 추가해 주세요." };
  }
  const memo = payload.memo.trim().slice(0, 500);

  const ids = [...new Set(payload.items.map((i) => i.exerciseId))];
  const { data: exercises } = await supabase
    .from("exercise_library")
    .select("*")
    .in("id", ids)
    .returns<Exercise[]>();
  const allowedById = new Map(
    filterExercisesForSelfWorkout(exercises ?? [], access.weighted).map((e) => [
      e.id,
      e,
    ]),
  );

  const rows = [];
  for (const [index, item] of payload.items.entries()) {
    const exercise = allowedById.get(item.exerciseId);
    if (!exercise) return { error: "선택할 수 없는 운동이 포함되어 있습니다." };
    const isDuration = exercise.unit_type === "duration";
    const name = exercise.name_ko ?? exercise.name_en;
    if (
      !inRange(item.sets, 1, 30) ||
      !inRange(item.reps, 1, 500) ||
      !inRange(item.durationSeconds, 1, 3600) ||
      !inRange(item.weightKg, 0, 500)
    ) {
      return { error: `${name}의 세트·횟수·무게 값을 확인해 주세요.` };
    }
    if (isDuration ? item.durationSeconds === null : item.reps === null) {
      return {
        error: `${name}의 ${isDuration ? "유지 시간" : "횟수"}을 입력해 주세요.`,
      };
    }
    rows.push({
      exercise_id: exercise.id,
      exercise_name: name,
      sets: item.sets,
      reps: isDuration ? null : item.reps,
      duration_seconds: isDuration ? item.durationSeconds : null,
      weight_kg: needsWeightInput(exercise.equipment) ? item.weightKg : null,
      sort_order: index,
    });
  }

  const { data: log, error: logError } = await supabase
    .from("self_workout_logs")
    .insert({
      member_id: member.id,
      workout_date: payload.date,
      memo: memo || null,
    })
    .select("id")
    .single();
  if (logError || !log)
    return { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." };

  const { error: itemsError } = await supabase
    .from("self_workout_items")
    .insert(rows.map((r) => ({ ...r, log_id: log.id })));
  if (itemsError) {
    await supabase.from("self_workout_logs").delete().eq("id", log.id);
    return { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/member/self-workout");
  revalidatePath("/member");
  return {};
}

export async function deleteSelfWorkout(logId: string): Promise<void> {
  const supabase = await createClient();
  // RLS가 본인 기록만 삭제되도록 보장한다.
  await supabase.from("self_workout_logs").delete().eq("id", logId);
  revalidatePath("/member/self-workout");
  revalidatePath("/member");
}
