import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Keep-alive endpoint: pinged on a schedule (cron-job.org) so the Supabase
// free-tier project keeps seeing real database activity and is not auto-paused.
// Public on purpose. The queries run as the anon role, so RLS returns no rows
// and nothing sensitive is exposed.
//
// Each ping issues several independent REST requests (one per table) so a
// single ping counts as multiple database requests on the Supabase side.
export const dynamic = "force-dynamic";

const KEEP_ALIVE_TABLES = ["exercise_library", "members", "routines"] as const;

export async function GET() {
  const supabase = await createClient();

  const results = await Promise.all(
    KEEP_ALIVE_TABLES.map((table) =>
      supabase.from(table).select("id").limit(1)
    )
  );

  const failed = results.filter((r) => r.error).length;

  if (failed > 0) {
    return NextResponse.json(
      { ok: false, failed, total: results.length },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, queries: results.length });
}
