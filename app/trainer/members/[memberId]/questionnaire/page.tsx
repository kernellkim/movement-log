import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { PARQ_QUESTIONS } from "@/lib/parq";
import type { HealthUpdate, Member, Questionnaire } from "@/lib/types";

const RISK_LABEL: Record<string, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};

export default async function MemberQuestionnairePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle<Member>();
  if (!member) notFound();

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_latest", true)
    .maybeSingle<Questionnaire>();

  const backButton = (
    <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/trainer" />}>
      ← 회원 목록
    </Button>
  );

  if (!questionnaire) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        {backButton}
        <h1 className="text-2xl font-semibold text-foreground">
          {member.name ?? "회원"} - PAR-Q 검사 결과
        </h1>
        <p className="text-sm text-muted-foreground">아직 작성된 문진표가 없습니다.</p>
      </div>
    );
  }

  const { data: healthUpdates } = await supabase
    .from("health_updates")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: true })
    .returns<HealthUpdate[]>();

  const answerByQuestionId = new Map(
    questionnaire.parq_answers.map((a) => [a.id, a.answer]),
  );

  const extraInfo = [
    { label: "부상 이력", value: questionnaire.injury_history },
    { label: "수술 이력", value: questionnaire.surgery_history },
    { label: "만성질환", value: questionnaire.chronic_condition },
  ].filter((item) => item.value);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      {backButton}

      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {member.name ?? "회원"} - PAR-Q 검사 결과
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge
            variant={
              questionnaire.risk_level === "high"
                    ? "riskHigh"
                    : questionnaire.risk_level === "mid"
                      ? "riskMid"
                      : "riskLow"
            }
          >
            {questionnaire.risk_level ? RISK_LABEL[questionnaire.risk_level] : "분석 중"}
          </Badge>
          <span>작성일: {formatDateTime(questionnaire.created_at)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">PAR-Q 문항</h2>
        <ul className="space-y-2">
          {PARQ_QUESTIONS.map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-foreground">{q.text}</span>
              <span className="shrink-0 font-medium text-muted-foreground">
                {answerByQuestionId.get(q.id) ? "예" : "아니오"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {extraInfo.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">추가 정보</h2>
          {extraInfo.map((item) => (
            <p key={item.label} className="text-sm">
              <span className="font-medium text-foreground">{item.label}:</span>{" "}
              <span className="text-muted-foreground">{item.value}</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">건강 상태 업데이트 내역</h2>
        {!healthUpdates || healthUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground">업데이트 내역이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {healthUpdates.map((update) => (
              <li key={update.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="text-foreground">{update.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(update.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
