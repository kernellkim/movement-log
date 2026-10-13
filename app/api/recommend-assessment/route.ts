import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJoinedMemberForTrainer, NOT_JOINED_MESSAGE } from "@/lib/member-access";
import { describeAiError } from "@/lib/ai-error";
import { recommendAssessmentItems } from "@/lib/assessment-recommend";
import { formatHealthUpdatesForPrompt } from "@/lib/format";
import type { HealthUpdate, Questionnaire } from "@/lib/types";

export async function POST(request: Request) {
  const { questionnaireId } = await request.json();
  if (!questionnaireId) {
    return NextResponse.json(
      { error: "questionnaireId is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: questionnaire, error: fetchError } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("id", questionnaireId)
    .single<Questionnaire>();

  if (fetchError || !questionnaire) {
    return NextResponse.json(
      { error: fetchError?.message ?? "questionnaire not found" },
      { status: 404 },
    );
  }

  const access = await getJoinedMemberForTrainer(supabase, questionnaire.member_id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "not_joined" ? NOT_JOINED_MESSAGE : "접근 권한이 없습니다." },
      { status: access.reason === "unauthenticated" ? 401 : access.reason === "not_joined" ? 403 : 404 },
    );
  }

  const { data: healthUpdates } = await supabase
    .from("health_updates")
    .select("*")
    .eq("member_id", questionnaire.member_id)
    .order("created_at", { ascending: true })
    .returns<HealthUpdate[]>();

  let recommended;
  try {
    recommended = await recommendAssessmentItems({
      parqAnswers: questionnaire.parq_answers,
      injuryHistory: questionnaire.injury_history ?? "",
      surgeryHistory: questionnaire.surgery_history ?? "",
      chronicCondition: questionnaire.chronic_condition ?? "",
      healthUpdatesText: formatHealthUpdatesForPrompt(healthUpdates ?? []),
    });
  } catch (e) {
    const { message, status } = describeAiError(e, "recommend-assessment");
    return NextResponse.json({ error: message }, { status });
  }

  const { data: assessment, error: insertError } = await supabase
    .from("assessments")
    .insert({
      member_id: questionnaire.member_id,
      questionnaire_id: questionnaire.id,
      recommended_items: recommended,
    })
    .select("id")
    .single();

  if (insertError || !assessment) {
    return NextResponse.json(
      { error: insertError?.message ?? "저장에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ assessmentId: assessment.id, ...recommended });
}
