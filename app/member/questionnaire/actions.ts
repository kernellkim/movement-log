"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { classifyRisk, parqFloor } from "@/lib/risk";
import { describeAiError } from "@/lib/ai-error";
import { recommendAssessmentItems } from "@/lib/assessment-recommend";
import { archiveActiveRoutines } from "@/lib/reassessment";
import { formatHealthUpdatesForPrompt } from "@/lib/format";
import { PARQ_QUESTIONS } from "@/lib/parq";
import { CONSENT_FIELD, hasConsent, recordConsents } from "@/lib/consent";
import type { HealthUpdate, ParqAnswer, Questionnaire } from "@/lib/types";

export async function submitQuestionnaire(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/login");

  // 민감정보(건강정보)는 별도 동의 없이는 저장하지 않는다. 가입 때 이미 동의했다면 통과.
  if (!(await hasConsent(supabase, member.id, "sensitive_health"))) {
    if (formData.get(CONSENT_FIELD.sensitive_health) !== "on") {
      redirect(
        `/member/questionnaire?error=${encodeURIComponent("건강정보 수집·이용에 동의해야 문진표를 제출할 수 있습니다.")}`,
      );
    }
    const { error: consentError } = await recordConsents(supabase, member.id, ["sensitive_health"]);
    if (consentError) {
      redirect(
        `/member/questionnaire?error=${encodeURIComponent("동의 저장에 실패했습니다. 다시 시도해 주세요.")}`,
      );
    }
  }

  const parqAnswers: ParqAnswer[] = PARQ_QUESTIONS.map((q) => ({
    id: q.id,
    answer: formData.get(`parq_${q.id}`) === "yes",
  }));

  const injuryHistory = String(formData.get("injury_history") ?? "");
  const surgeryHistory = String(formData.get("surgery_history") ?? "");
  const chronicCondition = String(formData.get("chronic_condition") ?? "");
  const birthDate = String(formData.get("birth_date") ?? "") || null;
  const gender = String(formData.get("gender") ?? "") || null;

  await supabase
    .from("members")
    .update({ birth_date: birthDate, gender })
    .eq("id", member.id);

  await supabase
    .from("questionnaires")
    .update({ is_latest: false })
    .eq("member_id", member.id);

  const { data: inserted, error: insertError } = await supabase
    .from("questionnaires")
    .insert({
      member_id: member.id,
      parq_answers: parqAnswers,
      injury_history: injuryHistory,
      surgery_history: surgeryHistory,
      chronic_condition: chronicCondition,
      is_latest: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect(
      `/member/questionnaire?error=${encodeURIComponent(insertError?.message ?? "저장에 실패했습니다")}`,
    );
  }

  // 문진표가 갱신되면 몸 상태를 다시 검토해야 하므로, 기존에 활성 상태였던
  // 루틴은 전부 보관 처리하고 재검사(검사 추천→입력→루틴 생성)부터 다시
  // 진행하도록 한다 - 안전을 위한 재검토 단계라 매번 무조건 실행한다.
  await archiveActiveRoutines(supabase, member.id);

  // AI 호출이 실패해도 회원 화면이 멈추지 않도록, 실패 시에는 PAR-Q 규칙 기준의
  // 위험도(안전 하한선)로 저장하고 검사 추천은 트레이너가 화면에서 다시 요청하게 둔다.
  let riskLevel = parqFloor(parqAnswers);
  try {
    riskLevel = (
      await classifyRisk({ parqAnswers, injuryHistory, surgeryHistory, chronicCondition })
    ).riskLevel;
  } catch (e) {
    describeAiError(e, "submitQuestionnaire:classifyRisk");
  }

  await supabase
    .from("questionnaires")
    .update({ risk_level: riskLevel })
    .eq("id", inserted.id);

  try {
    const recommended = await recommendAssessmentItems({
      parqAnswers,
      injuryHistory,
      surgeryHistory,
      chronicCondition,
    });
    await supabase.from("assessments").insert({
      member_id: member.id,
      questionnaire_id: inserted.id,
      recommended_items: recommended,
    });
  } catch (e) {
    describeAiError(e, "submitQuestionnaire:recommendAssessmentItems");
  }

  redirect("/member");
}

// 최초 문진표를 이미 작성한 회원은 PAR-Q 전체를 다시 쓰는 대신, 이 화면에서
// 변경된 내용만 짧게 알린다. questionnaires에 새 행을 만들지 않고, 최신
// 문진표 원본 + 지금까지 쌓인 health_updates 전체를 함께 반영해 risk_level만
// 갱신한다.
export async function submitHealthUpdate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/login");

  const note = String(formData.get("note") ?? "").trim();
  if (!note) {
    redirect(
      `/member/questionnaire?error=${encodeURIComponent("새로 추가할 내용을 입력해 주세요.")}`,
    );
  }

  const { data: latest } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("member_id", member.id)
    .eq("is_latest", true)
    .maybeSingle<Questionnaire>();

  if (!latest) {
    redirect(
      `/member/questionnaire?error=${encodeURIComponent("기존 문진표를 찾을 수 없습니다.")}`,
    );
  }

  await supabase.from("health_updates").insert({ member_id: member.id, note });

  // 문진표 재제출과 동일하게 "재검토 필요" 상태로 처리한다.
  await archiveActiveRoutines(supabase, member.id);

  const { data: healthUpdates } = await supabase
    .from("health_updates")
    .select("*")
    .eq("member_id", member.id)
    .order("created_at", { ascending: true })
    .returns<HealthUpdate[]>();

  // AI 분류가 실패해도 제출은 이미 저장됐으므로 회원 화면은 그대로 넘어가야 한다.
  // 이때는 기존 위험도를 유지하고(낮추지 않음), 루틴이 보관 처리돼 트레이너에게
  // "재검토 필요"로 표시된다.
  try {
    const { riskLevel } = await classifyRisk({
      parqAnswers: latest.parq_answers,
      injuryHistory: latest.injury_history ?? "",
      surgeryHistory: latest.surgery_history ?? "",
      chronicCondition: latest.chronic_condition ?? "",
      healthUpdatesText: formatHealthUpdatesForPrompt(healthUpdates ?? []),
    });
    await supabase.from("questionnaires").update({ risk_level: riskLevel }).eq("id", latest.id);
  } catch (e) {
    describeAiError(e, "submitHealthUpdate:classifyRisk");
  }

  redirect("/member");
}
