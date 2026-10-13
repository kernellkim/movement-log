import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { describeAiError } from "@/lib/ai-error";
import { formatHealthUpdatesForPrompt } from "@/lib/format";
import { generateRoutine } from "@/lib/routine-generate";
import { getSelfWorkoutAccess } from "@/lib/self-workout";
import type {
  Assessment,
  AssessmentResultRow,
  BodyComposition,
  Exercise,
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

  const { data: candidates } = await supabase
    .from("exercise_library")
    .select("*")
    .in("category", categories)
    .returns<Exercise[]>();

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
      candidates: candidates ?? [],
      healthUpdatesText: formatHealthUpdatesForPrompt(healthUpdates ?? []),
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
