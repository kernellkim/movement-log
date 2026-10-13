import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { describeAiError } from "@/lib/ai-error";
import { formatHealthUpdatesForPrompt } from "@/lib/format";
import { generateRoutine } from "@/lib/routine-generate";
import { getSelfWorkoutAccess } from "@/lib/self-workout";
import {
  AI_DAILY_LIMIT,
  countAiCallsToday,
  loadAllowedExercises,
  loadRecentTraining,
} from "@/lib/self-workout-history";
import type {
  Assessment,
  AssessmentResultRow,
  BodyComposition,
  HealthUpdate,
  Questionnaire,
} from "@/lib/types";

// 회원이 개인 운동을 시작할 때 받는 "AI 제안". 위험도가 낮음/보통인 회원만 쓸 수 있고,
// 트레이너 확인 전 참고용 초안이며 저장되는 것은 회원이 기록하는 개인 운동 기록뿐이다.
// 안전 필터(보통 이하는 맨몸·밴드만, 고충격 제외)는 트레이너용 루틴 생성과 같은 함수를 쓴다.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { categories } = await request
    .json()
    .catch(() => ({ categories: null }));
  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    categories.length > 4
  ) {
    return NextResponse.json(
      { error: "운동 부위를 1개 이상 골라 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  const member = await getMemberForUser(supabase, user.id);
  if (!member)
    return NextResponse.json(
      { error: "회원 계정만 사용할 수 있습니다." },
      { status: 403 },
    );

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("member_id", member.id)
    .eq("is_latest", true)
    .maybeSingle<Questionnaire>();
  const access = getSelfWorkoutAccess(
    questionnaire?.risk_level,
    Boolean(questionnaire),
  );
  if (!access.allowed || access.highRisk || !questionnaire) {
    return NextResponse.json(
      {
        error:
          "지금은 AI 제안을 받을 수 없어요. 지난 수업 루틴을 불러와서 기록해 주세요.",
      },
      { status: 403 },
    );
  }

  // Candidates are limited to exercises done with the trainer (checked in a session),
  // with the risk filter applied on top.
  const candidates = await loadAllowedExercises(
    supabase,
    member.id,
    access.weighted,
    categories,
  );
  if (candidates.length < 3) {
    return NextResponse.json(
      {
        error:
          "선택한 부위에서 트레이너와 함께 해 본 운동이 아직 부족해요. 다른 부위를 고르거나 지난 수업 루틴을 불러와 주세요.",
      },
      { status: 404 },
    );
  }

  if ((await countAiCallsToday(supabase, member.id)) >= AI_DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `AI 제안은 하루 ${AI_DAILY_LIMIT}번까지 받을 수 있어요. 내일 다시 시도하거나 지난 수업 루틴을 불러와 주세요.`,
      },
      { status: 429 },
    );
  }
  await supabase.from("self_workout_ai_calls").insert({ member_id: member.id });

  const recent = await loadRecentTraining(supabase, member.id);
  const extraContext = [
    "[최근 7일 운동 기록]",
    recent.summaryText || "기록 없음",
    "",
    "[개인 운동 안내] 후보 운동은 모두 회원이 트레이너와 함께 해 본 운동입니다. PT가 없는 날 혼자 하는 운동이므로 보수적인 세트·반복 수로 구성하고, 최근 이틀 안에 쓴 부위는 피하거나 부담을 줄이세요.",
  ].join("\n");

  const { data: latestAssessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Assessment, "id">>();
  const { data: assessmentResults } = latestAssessment
    ? await supabase
        .from("assessment_results")
        .select("*")
        .eq("assessment_id", latestAssessment.id)
        .returns<AssessmentResultRow[]>()
    : { data: [] as AssessmentResultRow[] };

  const { data: bodyComposition } = await supabase
    .from("body_composition_records")
    .select("*")
    .eq("member_id", member.id)
    .eq("is_latest", true)
    .maybeSingle<BodyComposition>();

  const { data: healthUpdates } = await supabase
    .from("health_updates")
    .select("*")
    .eq("member_id", member.id)
    .order("created_at", { ascending: true })
    .returns<HealthUpdate[]>();

  let draft;
  try {
    draft = await generateRoutine({
      questionnaire,
      assessmentResults: assessmentResults ?? [],
      bodyComposition: bodyComposition ?? null,
      categories,
      candidates,
      healthUpdatesText: formatHealthUpdatesForPrompt(healthUpdates ?? []),
      extraContext,
    });
  } catch (e) {
    const { message, status } = describeAiError(
      e,
      "member-self-workout-suggest",
    );
    return NextResponse.json({ error: message }, { status });
  }

  if (draft.items.length === 0) {
    return NextResponse.json(
      {
        error:
          "선택한 부위에 맞는 안전한 운동을 찾지 못했어요. 다른 부위를 골라 주세요.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    reasoning: draft.reasoning,
    items: draft.items.map((i) => ({
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: i.reps,
      durationSeconds: i.durationSeconds,
      cautionNote: i.cautionNote,
    })),
  });
}
