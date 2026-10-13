"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { CONSENT_FIELD, getMissingConsents, recordConsents } from "@/lib/consent";

export async function submitConsent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  // 서버에서 다시 한 번 필수 항목이 모두 체크됐는지 확인한다.
  const missing = await getMissingConsents(supabase, member.id);
  const allChecked = missing.every((type) => formData.get(CONSENT_FIELD[type]) === "on");
  if (!allChecked) {
    redirect(`/consent?error=${encodeURIComponent("필수 항목에 모두 동의해 주세요.")}`);
  }

  const { error } = await recordConsents(supabase, member.id, missing);
  if (error) {
    redirect(`/consent?error=${encodeURIComponent("동의 저장에 실패했습니다. 다시 시도해 주세요.")}`);
  }

  redirect("/member");
}
