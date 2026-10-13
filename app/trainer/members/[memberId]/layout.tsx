import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJoinedMemberForTrainer, NOT_JOINED_MESSAGE } from "@/lib/member-access";

// 검사·인바디·루틴·수업 등 회원별 화면은 가입을 마친 내 담당 회원에게만 열린다.
// 목록에서 버튼을 숨기는 것만으로는 주소 직접 입력을 막을 수 없어서 서버에서 확인한다.
export default async function MemberRoutesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();
  const access = await getJoinedMemberForTrainer(supabase, memberId);

  if (!access.ok) {
    if (access.reason === "unauthenticated") redirect("/login");
    if (access.reason === "not_joined") {
      redirect(`/trainer?error=${encodeURIComponent(NOT_JOINED_MESSAGE)}`);
    }
    notFound();
  }

  return <>{children}</>;
}
