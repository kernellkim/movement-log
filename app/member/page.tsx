import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { formatSetsReps } from "@/lib/format";
import { getSessionHistory } from "@/lib/session-history";
import type { Questionnaire } from "@/lib/types";

const RISK_LABEL: Record<string, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};

export default async function MemberDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getMemberForUser(supabase, user.id);
  if (!member) redirect("/trainer");

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("member_id", member.id)
    .eq("is_latest", true)
    .maybeSingle<Questionnaire>();

  const query = q?.trim() ?? "";
  const sessionHistory = await getSessionHistory(supabase, member.id, { query });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          안녕하세요, {member.name ?? "회원"}님
        </h1>
        <div className="flex items-center gap-2">
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>

      <p className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        이 정보는 의학적 진단이 아니며, 트레이너의 지도 하에 진행됩니다.
      </p>

      {questionnaire?.risk_level === "high" && (
        <AutoDismissNotice className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          ⚠️ 의료진 상담을 권장드립니다. 운동 시작 전 담당 트레이너와 상담해
          주세요.
        </AutoDismissNotice>
      )}

      <Card>
        <CardContent className="space-y-3">
          {questionnaire ? (
            <p className="text-sm text-muted-foreground">
              최근 문진표 위험도:{" "}
              <Badge
                variant={
                  questionnaire.risk_level === "high"
                    ? "riskHigh"
                    : questionnaire.risk_level === "mid"
                      ? "riskMid"
                      : "riskLow"
                }
              >
                {questionnaire.risk_level
                  ? RISK_LABEL[questionnaire.risk_level]
                  : "분석 중"}
              </Badge>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              아직 제출한 문진표가 없습니다.
            </p>
          )}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/member/questionnaire" />}
          >
            {questionnaire ? "건강 상태 업데이트" : "문진표 작성하기"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            최근 인바디 기록을 확인하고 추이를 확인해보세요
          </p>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/member/body-composition" />}
          >
            인바디 기록 보기
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">지난 수업 기록</h2>

        <form className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="운동 이름으로 검색 (예: 데드버그)"
          />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        {sessionHistory.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {query ? "검색 결과가 없습니다." : "아직 기록된 수업이 없어요."}
              </p>
            </CardContent>
          </Card>
        ) : (
          sessionHistory.map(({ log, items }) => (
            <Card key={log.id}>
              <CardHeader>
                <CardTitle>{log.session_date}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    기록된 운동이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const hasDetail = item.reps != null || item.durationSeconds != null;
                      return (
                        <li key={item.id} className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-foreground">
                              {item.exercise?.name_ko ??
                                item.exercise?.name_en ??
                                "알 수 없는 운동"}
                              {hasDetail && (
                                <span className="ml-1.5 text-muted-foreground">
                                  {formatSetsReps(
                                    item.sets,
                                    item.reps,
                                    item.durationSeconds,
                                    item.weightKg,
                                  )}
                                </span>
                              )}
                            </span>
                            {item.exercise?.video_url && (
                              <a
                                href={item.exercise.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
                              >
                                참고 영상 보기
                              </a>
                            )}
                          </div>
                          {item.isStale && (
                            <p className="text-xs text-amber-400">
                              이 운동은 이후 루틴이 수정되어 정확한 기록이 남아있지 않습니다
                              (현재 루틴 상태를 참고용으로 표시 중)
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {log.free_memo && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    오늘의 메모: {log.free_memo}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
