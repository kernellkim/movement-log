import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { getMissingConsents } from "@/lib/consent";
import { signOut } from "@/app/login/actions";
import {
  SensitiveHealthConsentField,
  TermsPrivacyConsentField,
} from "@/components/consent/consent-fields";
import { submitConsent } from "./actions";

// 기존 회원 또는 약관 버전이 바뀐 회원이 거쳐 가는 재동의 화면.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  const missing = await getMissingConsents(supabase, member.id);
  if (missing.length === 0) redirect("/member");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">개인정보 수집·이용 동의</CardTitle>
          <CardDescription>
            서비스를 계속 이용하려면 아래 내용에 동의해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitConsent} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {missing.includes("terms_privacy") && <TermsPrivacyConsentField />}
            {missing.includes("sensitive_health") && <SensitiveHealthConsentField />}
            <Button type="submit" size="lg" className="w-full">
              동의하고 계속하기
            </Button>
          </form>
          <form action={signOut} className="mt-3">
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              동의하지 않고 로그아웃
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
