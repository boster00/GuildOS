/**
 * POST /api/visibility_tracker/execute
 * Step 3 — Execute Jobs (spec). No DB read/write; returns job_reports only.
 * Body: { assigned_jobs: [{ job_id, job_type, metadata }] }
 * Returns: { success: true, job_reports: [{ job_id, ok, duration_ms, payload, error? }] }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { executeJobs } from "@/libs/visibility_tracker/worker/execute";

export async function POST(request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expectedCron = process.env.VT_CRON_SECRET || process.env.CRON_SECRET;
    const isCronCall = expectedCron && cronSecret === expectedCron;

    if (!isCronCall) {
      const serverSupabase = await createServerClient();
      const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const assigned_jobs = body.assigned_jobs;
    if (!Array.isArray(assigned_jobs)) {
      return NextResponse.json(
        { success: false, error: "ASSIGNED_JOBS_REQUIRED", message: "assigned_jobs must be an array" },
        { status: 400 }
      );
    }

    const logs = [];
    logs.push(`[Execute] Request: assigned_jobs count=${assigned_jobs.length}`);
    const job_reports = await executeJobs(assigned_jobs, logs);

    return NextResponse.json({
      success: true,
      job_reports,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "EXECUTE_FAILED", message: error?.message || "Execute failed", logs: [`[Execute] Exception: ${error?.message}`] },
      { status: 500 }
    );
  }
}
