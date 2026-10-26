import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTrainer } from "@/lib/auth";

// 트레이너가 담당 회원의 비밀번호 재설정 링크를 발급한다.
// 이메일 발송(Resend 도메인 미인증)에 의존하지 않고 링크만 만들어 화면에 보여준다.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // Only registered trainers (a row in public.trainers) may issue links.
  // This route uses the service role below, so the check has to happen here.
  if (!(await isTrainer(supabase, user.id))) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { memberId } = await request.json();
  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "회원 정보가 올바르지 않습니다." }, { status: 400 });
  }

  // RLS가 적용되는 일반 클라이언트로 조회하고, trainer_id까지 확인해
  // 내가 담당하는 회원에게만 발급되도록 한다.
  const { data: member } = await supabase
    .from("members")
    .select("id, user_id, trainer_id")
    .eq("id", memberId)
    .eq("trainer_id", user.id)
    .maybeSingle();
  if (!member || !member.user_id) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(
    member.user_id,
  );
  const email = authUser?.user?.email;
  if (userError || !email) {
    return NextResponse.json({ error: "회원 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 가입한 회원은 recovery 링크, 아직 초대 수락 전(이메일 미확인)인 회원은
  // recovery가 거부될 수 있어 magiclink로 한 번 더 시도한다.
  let linkType: "recovery" | "magiclink" = "recovery";
  let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    linkType = "magiclink";
    ({ data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    }));
  }
  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? "링크 발급에 실패했습니다." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;
  const next = encodeURIComponent("/auth/set-password?mode=reset");
  const resetUrl = `${origin}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=${linkType}&next=${next}`;

  return NextResponse.json({ resetUrl });
}
