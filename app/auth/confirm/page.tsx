import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  if (!token_hash || !type) {
    redirect(
      `/login?error=${encodeURIComponent("초대 링크가 유효하지 않거나 만료되었습니다. 트레이너에게 다시 요청해 주세요.")}`,
    );
  }

  const verifyUrl = `/auth/confirm/verify?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next ?? "/")}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // (주의) next/link는 화면에 보이는 순간 대상 주소를 미리 요청(prefetch)하는데, 대상이
  // 검증 라우트라면 그 요청이 일회용 토큰을 소모해 버린다. 반드시 일반 <a>를 쓴다.
  // 링크를 열자마자 자동으로 검증하지 않고 항상 버튼을 한 번 눌러야 진행한다.
  // 카카오톡·메신저 등의 링크 미리보기나 보안 스캐너가 링크를 먼저 열어 일회용
  // 토큰을 소모해 버리는 문제를 막기 위해서다 (자동 접속은 버튼을 누르지 않는다).
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            {user ? "계정 전환 확인" : "Movement.log"}
          </CardTitle>
          <CardDescription>
            {user
              ? "현재 다른 계정으로 로그인되어 있습니다. 이 링크를 계속 진행하면 링크의 계정으로 전환됩니다."
              : "아래 버튼을 눌러 비밀번호 설정을 계속해 주세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<a href={verifyUrl} />}
          >
            계속하기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
