import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// 관리자 API(generateLink)로 발급한 초대/재설정 링크는 세션을 URL 해시로 넘기는
// implicit grant 형식인데, 브라우저 클라이언트(@supabase/ssr)는 항상 PKCE로 동작해
// 그 해시를 세션으로 인식하지 못한다. 그래서 해시 대신 token_hash를 쿼리로 받아
// 서버에서 직접 검증하고, 그 결과로 세션 쿠키를 심어준 뒤 최종 페이지로 보낸다.
//
// verifyOtp는 세션 쿠키를 써야 해서 Route Handler에서만 실행할 수 있다 (Server
// Component 렌더링 중에는 쿠키를 쓸 수 없다) - 그래서 ../page.tsx가 확인 여부를
// 판단한 뒤 실제 검증은 이 라우트로 넘긴다.
export async function GET(request: Request) {
  // 브라우저/Next의 prefetch 요청은 검증하지 않는다 (일회용 토큰 보호).
  const purpose =
    request.headers.get("sec-purpose") ??
    request.headers.get("purpose") ??
    request.headers.get("next-router-prefetch");
  if (purpose || request.headers.get("rsc")) {
    return new NextResponse(null, { status: 204 });
  }

  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // 링크로 로그인된 계정 id를 짧게 기억해 둔다. /auth/set-password는 이 쿠키가
      // 현재 로그인 계정과 일치할 때만 열린다 (다른 계정의 비밀번호가 바뀌는 사고 방지).
      if (data.user) {
        response.cookies.set("pw_setup", data.user.id, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 10,
          path: "/auth",
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("초대 링크가 유효하지 않거나 만료되었습니다. 트레이너에게 다시 요청해 주세요.")}`,
  );
}
