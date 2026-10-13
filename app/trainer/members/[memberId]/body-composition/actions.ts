"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNextAssessmentStepUrl } from "@/lib/assessment-flow";
import { getJoinedMemberForTrainer, NOT_JOINED_MESSAGE } from "@/lib/member-access";

// 서버 액션은 화면 레이아웃을 거치지 않고 직접 호출될 수 있어서 여기서도 확인한다.
async function requireJoinedMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
) {
  const access = await getJoinedMemberForTrainer(supabase, memberId);
  if (access.ok) return;
  if (access.reason === "unauthenticated") redirect("/login");
  if (access.reason === "not_joined") {
    redirect(`/trainer?error=${encodeURIComponent(NOT_JOINED_MESSAGE)}`);
  }
  redirect("/trainer");
}

export async function saveBodyComposition(memberId: string, formData: FormData) {
  const supabase = await createClient();
  await requireJoinedMember(supabase, memberId);

  const measuredAt = String(formData.get("measured_at") ?? "");
  const weightKg = Number(formData.get("weight_kg"));
  const bodyFatMassKg = Number(formData.get("body_fat_mass_kg"));
  const skeletalMuscleMassKg = Number(formData.get("skeletal_muscle_mass_kg"));

  const toNullableNumber = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };
  const bodyFatPercentage = toNullableNumber("body_fat_percentage");
  const basalMetabolicRateKcal = toNullableNumber("basal_metabolic_rate_kcal");

  await supabase
    .from("body_composition_records")
    .update({ is_latest: false })
    .eq("member_id", memberId);

  const { error } = await supabase.from("body_composition_records").insert({
    member_id: memberId,
    measured_at: measuredAt,
    weight_kg: weightKg,
    body_fat_mass_kg: bodyFatMassKg,
    skeletal_muscle_mass_kg: skeletalMuscleMassKg,
    body_fat_percentage: bodyFatPercentage,
    basal_metabolic_rate_kcal: basalMetabolicRateKcal,
    is_latest: true,
  });

  if (error) {
    redirect(
      `/trainer/members/${memberId}/body-composition?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(await getNextAssessmentStepUrl(memberId));
}

export async function deleteBodyCompositionRecord(memberId: string, recordId: string) {
  const supabase = await createClient();
  await requireJoinedMember(supabase, memberId);
  const { error } = await supabase
    .from("body_composition_records")
    .delete()
    .eq("id", recordId)
    .eq("member_id", memberId);

  if (error) {
    const message =
      error.code === "23503"
        ? "이 기록은 루틴 생성에 사용된 적이 있어 삭제할 수 없습니다."
        : error.message;
    redirect(`/trainer/members/${memberId}/body-composition?error=${encodeURIComponent(message)}`);
  }

  // 삭제된 기록이 is_latest였다면, 남은 기록 중 측정일이 가장 최근인 것을
  // is_latest = true로 승격시킨다.
  const { data: remaining } = await supabase
    .from("body_composition_records")
    .select("id")
    .eq("member_id", memberId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (remaining) {
    await supabase
      .from("body_composition_records")
      .update({ is_latest: true })
      .eq("id", remaining.id);
  }

  redirect(`/trainer/members/${memberId}/body-composition`);
}
