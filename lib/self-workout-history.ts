import type { SupabaseClient } from "@supabase/supabase-js";
import { filterExercisesForSelfWorkout, todayKst } from "@/lib/self-workout";
import type { Exercise } from "@/lib/types";

// Personal workouts are limited to exercises the member has actually done (checked) in
// a session with the trainer. The risk filter is applied on top of that by callers.
export async function loadTrainerExerciseIds(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("session_logs")
    .select("session_log_items(exercise_id, checked)")
    .eq("member_id", memberId)
    .returns<
      { session_log_items: { exercise_id: string | null; checked: boolean }[] }[]
    >();
  const ids = new Set<string>();
  for (const log of data ?? []) {
    for (const item of log.session_log_items ?? []) {
      if (item.checked && item.exercise_id) ids.add(item.exercise_id);
    }
  }
  return ids;
}

export async function loadAllowedExercises(
  supabase: SupabaseClient,
  memberId: string,
  weighted: boolean,
  categories?: string[],
): Promise<Exercise[]> {
  const ids = [...(await loadTrainerExerciseIds(supabase, memberId))];
  if (ids.length === 0) return [];
  let query = supabase.from("exercise_library").select("*").in("id", ids);
  if (categories?.length) query = query.in("category", categories);
  const { data } = await query.order("name_ko").returns<Exercise[]>();
  return filterExercisesForSelfWorkout(data ?? [], weighted);
}

export type RecentTraining = {
  // Categories trained in the last 2 days (KST), from sessions and personal logs
  recentCategories: string[];
  // Human-readable lines for the AI prompt
  summaryText: string;
};

function daysAgoKst(days: number): string {
  const d = new Date(`${todayKst()}T00:00:00+09:00`);
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d);
}

export async function loadRecentTraining(
  supabase: SupabaseClient,
  memberId: string,
): Promise<RecentTraining> {
  const since = daysAgoKst(7);
  const [{ data: sessions }, { data: personal }] = await Promise.all([
    supabase
      .from("session_logs")
      .select("session_date, session_log_items(exercise_id, checked)")
      .eq("member_id", memberId)
      .gte("session_date", since)
      .returns<
        {
          session_date: string;
          session_log_items: { exercise_id: string | null; checked: boolean }[];
        }[]
      >(),
    supabase
      .from("self_workout_logs")
      .select("workout_date, self_workout_items(exercise_id)")
      .eq("member_id", memberId)
      .gte("workout_date", since)
      .returns<
        {
          workout_date: string;
          self_workout_items: { exercise_id: string | null }[];
        }[]
      >(),
  ]);

  const exerciseIds = new Set<string>();
  for (const s of sessions ?? [])
    for (const i of s.session_log_items ?? [])
      if (i.checked && i.exercise_id) exerciseIds.add(i.exercise_id);
  for (const p of personal ?? [])
    for (const i of p.self_workout_items ?? [])
      if (i.exercise_id) exerciseIds.add(i.exercise_id);

  const { data: lib } = exerciseIds.size
    ? await supabase
        .from("exercise_library")
        .select("id, category")
        .in("id", [...exerciseIds])
        .returns<{ id: string; category: string | null }[]>()
    : { data: [] as { id: string; category: string | null }[] };
  const categoryById = new Map((lib ?? []).map((e) => [e.id, e.category]));

  const lines: { date: string; label: string; categories: Set<string> }[] = [];
  for (const s of sessions ?? []) {
    const cats = new Set<string>();
    for (const i of s.session_log_items ?? []) {
      const c = i.checked && i.exercise_id ? categoryById.get(i.exercise_id) : null;
      if (c) cats.add(c);
    }
    if (cats.size) lines.push({ date: s.session_date, label: "PT 수업", categories: cats });
  }
  for (const p of personal ?? []) {
    const cats = new Set<string>();
    for (const i of p.self_workout_items ?? []) {
      const c = i.exercise_id ? categoryById.get(i.exercise_id) : null;
      if (c) cats.add(c);
    }
    if (cats.size) lines.push({ date: p.workout_date, label: "개인 운동", categories: cats });
  }
  lines.sort((a, b) => b.date.localeCompare(a.date));

  const cutoff = daysAgoKst(1); // today and yesterday
  const recent = new Set<string>();
  for (const l of lines) if (l.date >= cutoff) for (const c of l.categories) recent.add(c);

  return {
    recentCategories: [...recent],
    summaryText: lines.length
      ? lines
          .map((l) => `- ${l.date} ${l.label}: ${[...l.categories].join(", ")}`)
          .join("\n")
      : "",
  };
}

export const AI_DAILY_LIMIT = 5;

export async function countAiCallsToday(
  supabase: SupabaseClient,
  memberId: string,
): Promise<number> {
  const since = new Date(`${todayKst()}T00:00:00+09:00`).toISOString();
  const { count } = await supabase
    .from("self_workout_ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("created_at", since);
  return count ?? 0;
}
