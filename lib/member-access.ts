import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/types";

// "가입완료" = 비밀번호를 설정했고, 이용약관·개인정보 동의와 건강정보 동의를
// 모두 한 번 이상 마친 회원. (약관 버전이 바뀌어 재동의가 필요한 회원은 이미
// 가입한 상태이므로 여기서는 버전을 따지지 않는다.) 트레이너 목록의 가입 상태
// 계산(app/trainer/page.tsx)과 같은 기준이다.
export async function isMemberJoined(
  supabase: SupabaseClient,
  member: Pick<Member, "id" | "password_set_at">,
): Promise<boolean> {
  if (!member.password_set_at) return false;
  const { data } = await supabase
    .from("consent_records")
    .select("consent_type")
    .eq("member_id", member.id);
  const types = new Set((data ?? []).map((r) => r.consent_type as string));
  return types.has("terms_privacy") && types.has("sensitive_health");
}

export type TrainerMemberAccess =
  | { ok: true; member: Member }
  | { ok: false; reason: "unauthenticated" | "not_found" | "not_joined" };

// 트레이너가 이 회원의 검사·인바디·루틴·수업 화면과 AI 기능을 쓸 수 있는지 확인한다.
// 내 담당 회원이 아니면 not_found, 아직 가입을 마치지 않았으면 not_joined.
export async function getJoinedMemberForTrainer(
  supabase: SupabaseClient,
  memberId: string,
): Promise<TrainerMemberAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("trainer_id", user.id)
    .maybeSingle<Member>();
  if (!member) return { ok: false, reason: "not_found" };

  if (!(await isMemberJoined(supabase, member))) {
    return { ok: false, reason: "not_joined" };
  }
  return { ok: true, member };
}

export const NOT_JOINED_MESSAGE =
  "아직 가입을 마치지 않은 회원이라 이 기능을 사용할 수 없습니다. 회원이 가입을 완료한 뒤 이용해 주세요.";
