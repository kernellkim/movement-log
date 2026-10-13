import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentType } from "@/lib/types";

// 약관/처리방침/동의 문구를 바꿀 때 이 값을 올리면, 모든 회원이 다음 접속 때
// 새 버전에 다시 동의하게 된다. (consent_records.version과 비교)
export const CONSENT_VERSION = "2026-10-13";

export const CONSENT_FIELD = {
  terms_privacy: "consent_terms_privacy",
  sensitive_health: "consent_sensitive_health",
} as const satisfies Record<ConsentType, string>;

// 이 회원이 아직 현재 버전으로 동의하지 않은 항목을 돌려준다.
// - terms_privacy: 모든 회원 필수
// - sensitive_health: 건강정보(문진표)를 이미 제출한 회원만 필수.
//   아직 문진표가 없는 회원은 문진표 작성 화면에서 동의를 받는다.
export async function getMissingConsents(
  supabase: SupabaseClient,
  memberId: string,
): Promise<ConsentType[]> {
  const [{ data: records }, { data: questionnaires }] = await Promise.all([
    supabase
      .from("consent_records")
      .select("consent_type")
      .eq("member_id", memberId)
      .eq("version", CONSENT_VERSION),
    supabase.from("questionnaires").select("id").eq("member_id", memberId).limit(1),
  ]);

  const given = new Set((records ?? []).map((r) => r.consent_type as ConsentType));
  const missing: ConsentType[] = [];
  if (!given.has("terms_privacy")) missing.push("terms_privacy");
  if ((questionnaires?.length ?? 0) > 0 && !given.has("sensitive_health")) {
    missing.push("sensitive_health");
  }
  return missing;
}

export async function recordConsents(
  supabase: SupabaseClient,
  memberId: string,
  types: ConsentType[],
) {
  if (types.length === 0) return { error: null };
  return supabase.from("consent_records").upsert(
    types.map((consent_type) => ({
      member_id: memberId,
      consent_type,
      version: CONSENT_VERSION,
    })),
    { onConflict: "member_id,consent_type,version", ignoreDuplicates: true },
  );
}
