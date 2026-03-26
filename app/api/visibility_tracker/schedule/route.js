/**
 * POST /api/visibility_tracker/schedule
 * Step 1 — Schedule Jobs (spec).
 * Body: { source: 'demo' | 'db', run_type?: string, demo_contract?: { domain, keywords[], prompts[{ text, models[] }], ai_provider } }
 * Returns: { run_id, jobs_created, job_ids[] } or { success: false, error: CODE, message }
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { schedule as scheduleJobs } from "@/libs/visibility_tracker/scheduler/schedule";

export async function POST(request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expectedCron = process.env.VT_CRON_SECRET || process.env.CRON_SECRET;
    const isCronCall = expectedCron && cronSecret === expectedCron;

    let userId = null;

    if (!isCronCall) {
      const serverSupabase = await createServerClient();
      const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }
      userId = user.id;
    }

    // Use pure service-role client (no cookies) so cron ops bypass RLS
    const supabase = createServiceRoleClient();

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "DEMO_JSON_PARSE_ERROR", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const logs = [];
    logs.push(`[Schedule] Request payload: source=${body.source}, run_type=${body.run_type ?? "manual"}, demo_contract keys=${Object.keys(body.demo_contract || {}).join(", ")}`);
    const result = await scheduleJobs(supabase, body, userId, logs);

    if (!result.success) {
      const status = result.error === "INVALID_SOURCE" || result.error === "DEMO_JSON_PARSE_ERROR" ? 400 : 500;
      return NextResponse.json(
        { success: false, error: result.error, message: result.message, logs },
        { status }
      );
    }

    logs.push(`[Schedule] Success: run_id=${result.run_id}, jobs_created=${result.jobs_created}`);
    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      jobs_created: result.jobs_created,
      job_ids: result.job_ids || [],
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "JOB_BUILD_FAILED", message: error?.message || "Schedule failed", logs: [`[Schedule] Exception: ${error?.message}`] },
      { status: 500 }
    );
  }
}
