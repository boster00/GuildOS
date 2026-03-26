/**
 * POST /api/visibility_tracker/archive
 * Step 5 — Archive Jobs (spec).
 * Body: { run_id?: string }
 * Returns: { success: true, deleted_jobs: number, remaining_jobs: number }
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { archiveJobs } from "@/libs/visibility_tracker/jobs/archive";

export async function POST(request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expectedCron = process.env.VT_CRON_SECRET || process.env.CRON_SECRET;
    const isCronCall = expectedCron && cronSecret === expectedCron;

    let supabase;
    if (isCronCall) {
      supabase = createServiceRoleClient();
    } else {
      const serverSupabase = await createServerClient();
      const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }
      supabase = createServiceRoleClient();
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const run_id = body.run_id ?? null;

    const logs = [];
    logs.push(`[Archive] Request: run_id=${run_id ?? "all"}`);
    const result = await archiveJobs(supabase, { run_id, logs });

    return NextResponse.json({
      success: true,
      deleted_jobs: result.deleted_jobs,
      remaining_jobs: result.remaining_jobs,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "ARCHIVE_FAILED", message: error?.message || "Archive failed", logs: [`[Archive] Exception: ${error?.message}`] },
      { status: 500 }
    );
  }
}
