"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTrainer } from "@/lib/auth";

// members.user_id -> auth.users는 CASCADE가 아니라 NO ACTION이라, auth 계정을
// 먼저 지우면 이 members 행이 그 계정을 참조 중이라는 이유로 삭제가 실패한다.
// 그래서 순서를 반대로 한다: members 행을 먼저 지워 문진표·인바디·루틴·수업기록을
// (모두 CASCADE로 연결됨) 함께 정리한 뒤, 더 이상 참조가 없어진 auth 계정을
// admin API로 지운다.
export async function deleteMember(memberId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only registered trainers (a row in public.trainers) may delete members and their logins.
  if (!(await isTrainer(supabase, user.id))) {
    redirect(`/trainer?error=${encodeURIComponent("권한이 없습니다.")}`);
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, user_id, is_demo_protected")
    .eq("id", memberId)
    .eq("trainer_id", user.id)
    .maybeSingle();

  if (!member) {
    redirect(`/trainer?error=${encodeURIComponent("회원을 찾을 수 없습니다.")}`);
  }

  if (member.is_demo_protected) {
    redirect(`/trainer?error=${encodeURIComponent("데모용 계정은 삭제할 수 없습니다.")}`);
  }

  const { error: deleteError } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId);

  if (deleteError) {
    redirect(`/trainer?error=${encodeURIComponent(deleteError.message)}`);
  }

  if (member.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(member.user_id);
  }

  revalidatePath("/trainer");
}
