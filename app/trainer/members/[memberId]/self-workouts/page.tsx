import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SelfWorkoutList } from "@/components/self-workout-list";
import type { Member, SelfWorkoutLog } from "@/lib/types";

export default async function MemberSelfWorkoutsPage({
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

  const { data: logs } = await supabase
    .from("self_workout_logs")
    .select("*, self_workout_items(*)")
    .eq("member_id", memberId)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<SelfWorkoutLog[]>();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/trainer" />}>
        ← 회원 목록
      </Button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {member.name ?? "회원"} - 자율 운동 기록
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          회원이 PT 없는 날 직접 기록한 운동이에요. 최근 60건까지 보여드려요.
        </p>
      </div>

      <div className="space-y-3">
        <SelfWorkoutList logs={logs ?? []} emptyText="아직 기록된 자율 운동이 없어요." />
      </div>
    </div>
  );
}
