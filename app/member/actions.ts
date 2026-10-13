"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";

// 회원이 탈퇴(개인정보 삭제)를 요청한다. 즉시 삭제하지 않고, 담당 트레이너가
// 확인한 뒤 직접 삭제한다 (처리방침: 요청일로부터 7일 이내).
async function setDeletionRequest(requested: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  await supabase
    .from("members")
    .update({ deletion_requested_at: requested ? new Date().toISOString() : null })
    .eq("id", member.id);

  revalidatePath("/member");
}

export async function requestDeletion() {
  await setDeletionRequest(true);
}

export async function cancelDeletionRequest() {
  await setDeletionRequest(false);
}
