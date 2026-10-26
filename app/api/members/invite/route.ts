import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTrainer } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // Only registered trainers (a row in public.trainers) may invite members.
  // This route inserts with the service role, so the check has to happen here.
  if (!(await isTrainer(supabase, user.id))) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { name, email, birthDate, gender } = await request.json();
  if (!name || !email || !birthDate || !gender) {
    return NextResponse.json(
      { error: "모든 항목을 입력해 주세요." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const origin = new URL(request.url).origin;

  // Resend는 트레이너 본인 이메일 외로는 발송이 안 되므로(도메인 미인증),
  // 메일을 보내지 않고 초대 링크만 발급해 화면에 표시한다.
  // generateLink(type: "invite")는 계정 생성까지 함께 처리한다.
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${origin}/auth/set-password` },
    });

  if (linkError || !linkData.user) {
    const isDuplicate = linkError?.code === "email_exists";
    return NextResponse.json(
      {
        error: isDuplicate
          ? "이미 등록된 이메일입니다."
          : (linkError?.message ?? "초대에 실패했습니다."),
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  // service_role로 insert하므로 members 테이블의 insert RLS 정책 여부와 무관하게 동작한다.
  // ponytail: 이 insert가 실패하면 auth 사용자만 초대된 채 members 행이 없는 상태로 남는다 -
  // 재시도/정리 로직은 실제로 발생할 때 추가.
  const { error: insertError } = await admin.from("members").insert({
    trainer_id: user.id,
    user_id: linkData.user.id,
    name,
    birth_date: birthDate,
    gender,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // action_link 대신 우리 /auth/confirm 라우트로 보낸다 - GoTrue의 hosted verify
  // 리다이렉트는 세션을 URL 해시로 넘기는데, 브라우저 클라이언트가 항상 PKCE로
  // 동작해 그 해시를 세션으로 인식하지 못하기 때문이다.
  const inviteUrl = `${origin}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/set-password`;

  return NextResponse.json({ inviteUrl });
}
