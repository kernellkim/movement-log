import { redirect } from "next/navigation";
import Link from "next/link";
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

  // 이미 로그인된 세션이 없는 일반적인 경우(초대받은 회원이 링크를 처음 여는
  // 경로)는 확인 절차 없이 곧장 검증 라우트로 넘긴다.
  if (!user) {
    redirect(verifyUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">계정 전환 확인</CardTitle>
          <CardDescription>
            현재 다른 계정으로 로그인되어 있습니다. 이 링크를 계속 진행하면
            초대받은 계정으로 전환됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<Link href={verifyUrl} />}
          >
            계속하기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
