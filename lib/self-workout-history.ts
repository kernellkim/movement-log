import type { SupabaseClient } from "@supabase/supabase-js";
import { filterExercisesForSelfWorkout, todayKst } from "@/lib/self-workout";
import type { Exercise } from "@/lib/types";

// Personal workouts are limited to exercises the member has actually done (checked) in
// a session with the trainer. The risk filter is applied on top of that by callers.
type SessionRow = {
  created_at: string;
  session_date: string;
  session_log_items: {
    exercise_id: string | null;
    checked: boolean;
    sets: number | null;
    reps: number | null;
    duration_seconds: number | null;
    weight_kg: number | null;
  }[];
};

export type LastValue = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  lastDate: string;
};

async function loadSessions(
  supabase: SupabaseClient,
  memberId: string,
): Promise<SessionRow[]> {
  const { data } = await supabase
    .from("session_logs")
    .select(
      "created_at, session_date, session_log_items(exercise_id, checked, sets, reps, duration_seconds, weight_kg)",
    )
    .eq("member_id", memberId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<SessionRow[]>();
  return data ?? [];
}

export async function loadTrainerExerciseIds(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const log of await loadSessions(supabase, memberId)) {
    for (const item of log.session_log_items ?? []) {
      if (item.checked && item.exercise_id) ids.add(item.exercise_id);
    }
  }
  return ids;
}

function daysAgoKst(days: number): string {
  const d = new Date(`${todayKst()}T00:00:00+09:00`);
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d);
}

export type PersonalWorkoutContext = {
  exercises: Exercise[]; // pool: done with the trainer ∩ risk filter
  lastValues: LastValue[]; // most recent trainer-session values per exercise
  recentCategories: string[]; // categories trained today/yesterday (sessions + personal)
  recommendedCategories: string[];
  // A health update / questionnaire / InBody newer than the last session means the
  // trainer has not re-checked yet, so recommendations are paused.
  needsTrainerCheck: boolean;
};

export async function loadPersonalWorkoutContext(
  supabase: SupabaseClient,
  memberId: string,
  weighted: boolean,
): Promise<PersonalWorkoutContext> {
  const sessions = await loadSessions(supabase, memberId);

  const lastById = new Map<string, LastValue>();
  for (const s of sessions) {
    for (const i of s.session_log_items ?? []) {
      if (!i.checked || !i.exercise_id || lastById.has(i.exercise_id)) continue;
      lastById.set(i.exercise_id, {
        exerciseId: i.exercise_id,
        sets: i.sets,
        reps: i.reps,
        durationSeconds: i.duration_seconds,
        weightKg: i.weight_kg,
        lastDate: s.session_date,
      });
    }
  }

  const ids = [...lastById.keys()];
  const { data: lib } = ids.length
    ? await supabase
        .from("exercise_library")
        .select("*")
        .in("id", ids)
        .order("name_ko")
        .returns<Exercise[]>()
    : { data: [] as Exercise[] };
  const exercises = filterExercisesForSelfWorkout(lib ?? [], weighted);
  const allowed = new Set(exercises.map((e) => e.id));
  const lastValues = [...lastById.values()].filter((v) =>
    allowed.has(v.exerciseId),
  );
  const categoryById = new Map(exercises.map((e) => [e.id, e.category]));

  // Categories used today/yesterday, from trainer sessions and personal logs
  const cutoff = daysAgoKst(1);
  const recent = new Set<string>();
  for (const s of sessions) {
    if (s.session_date < cutoff) continue;
    for (const i of s.session_log_items ?? []) {
      const c = i.checked && i.exercise_id ? categoryById.get(i.exercise_id) : null;
      if (c) recent.add(c);
    }
  }
  const { data: personal } = await supabase
    .from("self_workout_logs")
    .select("self_workout_items(exercise_id)")
    .eq("member_id", memberId)
    .gte("workout_date", cutoff)
    .returns<{ self_workout_items: { exercise_id: string | null }[] }[]>();
  for (const p of personal ?? [])
    for (const i of p.self_workout_items ?? []) {
      const c = i.exercise_id ? categoryById.get(i.exercise_id) : null;
      if (c) recent.add(c);
    }

  const poolCategories = Array.from(
    new Set(exercises.map((e) => e.category).filter(Boolean) as string[]),
  );
  const rested = poolCategories.filter((c) => !recent.has(c));

  // Trainer re-check needed?
  const lastSessionAt = sessions[0]?.created_at ?? null;
  let needsTrainerCheck = false;
  if (lastSessionAt) {
    const [{ data: hu }, { data: q }, { data: bc }] = await Promise.all([
      supabase
        .from("health_updates")
        .select("created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ created_at: string }[]>(),
      supabase
        .from("questionnaires")
        .select("created_at")
        .eq("member_id", memberId)
        .eq("is_latest", true)
        .limit(1)
        .returns<{ created_at: string }[]>(),
      supabase
        .from("body_composition_records")
        .select("created_at")
        .eq("member_id", memberId)
        .eq("is_latest", true)
        .limit(1)
        .returns<{ created_at: string }[]>(),
    ]);
    needsTrainerCheck = [hu?.[0], q?.[0], bc?.[0]].some(
      (r) => r && r.created_at > lastSessionAt,
    );
  }

  return {
    exercises,
    lastValues,
    recentCategories: [...recent],
    recommendedCategories: rested.length ? rested : poolCategories,
    needsTrainerCheck,
  };
}
