import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Movement.log 로그인
          </CardTitle>
          <CardDescription>회원 또는 트레이너 계정으로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-5">
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" name="email" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" type="password" name="password" required />
            </div>

            <Button type="submit" size="lg" className="w-full">
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="w-full max-w-sm space-y-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        <p>테스트 계정</p>
        <p>트레이너: admin@test.com / admin</p>
        <p>회원: test2@test.com / test2</p>
        <p>회원: test3@test.com / test3</p>
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-2">
          이용약관
        </Link>
        {" · "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
      </p>
    </div>
  );
}
