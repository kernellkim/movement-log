import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { getMissingConsents } from "@/lib/consent";

// 회원 화면 전체의 동의 게이트: 현재 버전의 필수 동의가 없으면 /consent로 보낸다.
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (member) {
    const missing = await getMissingConsents(supabase, member.id);
    if (missing.length > 0) redirect("/consent");
  }

  return <>{children}</>;
}
