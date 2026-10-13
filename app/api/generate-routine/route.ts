import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJoinedMemberForTrainer, NOT_JOINED_MESSAGE } from "@/lib/member-access";
import { describeAiError } from "@/lib/ai-error";
import { generateRoutine } from "@/lib/routine-generate";
import { formatHealthUpdatesForPrompt } from "@/lib/format";
import type {
  AssessmentResultRow,
  BodyComposition,
  Exercise,
  HealthUpdate,
  Questionnaire,
} from "@/lib/types";

export async function POST(request: Request) {
  const { memberId, assessmentId, categories } = await request.json();
  if (!memberId || !assessmentId || !Array.isArray(categories) || !categories.length) {
    return NextResponse.json(
      { error: "memberId, assessmentId, categories가 필요합니다." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const access = await getJoinedMemberForTrainer(supabase, memberId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "not_joined" ? NOT_JOINED_MESSAGE : "접근 권한이 없습니다." },
      { status: access.reason === "unauthenticated" ? 401 : access.reason === "not_joined" ? 403 : 404 },
    );
  }

  const { data: questionnaire, error: qError } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_latest", true)
    .single<Questionnaire>();

  if (qError || !questionnaire) {
    return NextResponse.json(
      { error: "문진표를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: assessmentResults } = await supabase
    .from("assessment_results")
    .select("*")
    .eq("assessment_id", assessmentId)
    .returns<AssessmentResultRow[]>();

  const { data: candidates, error: exError } = await supabase
    .from("exercise_library")
    .select("*")
    .in("category", categories)
    .returns<Exercise[]>();

  if (exError) {
    return NextResponse.json({ error: exError.message }, { status: 500 });
  }

  const { data: bodyComposition } = await supabase
    .from("body_composition_records")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_latest", true)
    .maybeSingle<BodyComposition>();

  const { data: healthUpdates } = await supabase
    .from("health_updates")
    .select("*")
    .eq("member_id", memberId)
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
    const { message, status } = describeAiError(e, "generate-routine");
    return NextResponse.json({ error: message }, { status });
  }

  const candidateById = new Map((candidates ?? []).map((c) => [c.id, c]));

  return NextResponse.json({
    reasoning: draft.reasoning,
    warnings: draft.warnings ?? null,
    items: draft.items.map((item) => ({
      ...item,
      exercise: candidateById.get(item.exerciseId),
    })),
    bodyCompositionId: bodyComposition?.id ?? null,
  });
}
