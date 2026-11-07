import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isTrainer } from "@/lib/auth";
import { todayKst } from "@/lib/self-workout";
import { Button } from "@/components/ui/button";
import { ScheduleCalendar } from "./schedule-calendar";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Same check as the button on /trainer: only a row in public.trainers gets in.
  if (!(await isTrainer(supabase, user.id))) redirect("/trainer");

  const { data: members } = await supabase
    .from("members")
    .select("id, name")
    .eq("trainer_id", user.id)
    .order("name")
    .returns<{ id: string; name: string }[]>();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">스케줄</h1>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/trainer" />}
        >
          담당 회원
        </Button>
      </div>
      <ScheduleCalendar today={todayKst()} members={members ?? []} />
    </div>
  );
}
