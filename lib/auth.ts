import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/types";

// members.user_id가 본인이면 회원, 아니면 트레이너로 취급한다.
export async function getMemberForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<Member | null> {
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<Member>();

  return data;
}

// A trainer is a user with a row in public.trainers (RLS lets a trainer read their own row).
// If the table is missing or the query fails, the user is treated as not a trainer.
export async function isTrainer(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("trainers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !!data;
}

// 세션/인증 리프레시 타이밍 등으로 인한 일시적 조회 실패를 흡수하기 위해
// 한 번만 재시도한다. 재시도까지 실패하면 실제로 존재하지 않는 회원으로 간주한다.
export async function getMemberByIdWithRetry(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Member | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle<Member>();
    if (data) return data;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}
