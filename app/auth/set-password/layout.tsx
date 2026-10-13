import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 비밀번호 설정 화면은 "초대/재설정 링크를 방금 연 바로 그 계정"만 쓸 수 있다.
// 이미 다른 계정(예: 트레이너)으로 로그인한 채 이 주소로 들어와 비밀번호를 입력하면
// 그 계정의 비밀번호가 바뀌는 사고를 막기 위해, 링크 검증 시 심어 둔 쿠키(계정 id)가
// 현재 로그인한 계정과 일치할 때만 화면을 보여준다.
export default async function SetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const expectedUserId = cookieStore.get("pw_setup")?.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !expectedUserId || expectedUserId !== user.id) {
    redirect("/");
  }

  return <>{children}</>;
}
