import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Keep-alive endpoint: pinged on a schedule (cron-job.org) so the Supabase
// free-tier project keeps seeing real database activity and is not auto-paused.
// Public on purpose. The query runs as the anon role, so RLS returns no rows
// and nothing sensitive is exposed.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("exercise_library")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
