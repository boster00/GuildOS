/**
 * POST /api/visibility_tracker/log-results
 * Step 4 — Log Job Results (spec).
 * Body: { run_id: string, job_reports: [{ job_id, ok, duration_ms, payload, error? }] }
 * Returns: { success: true, persisted: [{ result_table, result_id }], job_updates: [{ job_id, status }] }
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { logResults } from "@/libs/visibility_tracker/jobs/logResults";
import { validateJobReport } from "@/libs/visibility_tracker/schemas";

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
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { run_id, job_reports } = body;
    if (!run_id) {
      return NextResponse.json(
        { success: false, error: "RUN_ID_INVALID", message: "run_id is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(job_reports)) {
      return NextResponse.json(
        { success: false, error: "JOB_REPORTS_REQUIRED", message: "job_reports must be an array" },
        { status: 400 }
      );
    }
    for (let i = 0; i < job_reports.length; i++) {
      const { valid, error: err } = validateJobReport(job_reports[i]);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: err || "JOB_REPORT_INVALID", message: `job_reports[${i}]: ${err}` },
          { status: 400 }
        );
      }
    }

    const logs = [];
    logs.push(`[Log Results] Request: run_id=${run_id}, job_reports count=${job_reports.length}`);
    const result = await logResults(supabase, { run_id, job_reports, logs });

    return NextResponse.json({
      success: true,
      persisted: result.persisted,
      job_updates: result.job_updates,
      logs,
    });
  } catch (error) {
    const code = error?.message === "RUN_ID_AND_REPORTS_REQUIRED" ? "RUN_ID_AND_REPORTS_REQUIRED" : "LOG_RESULTS_FAILED";
    return NextResponse.json(
      { success: false, error: code, message: error?.message || "Log results failed", logs: [`[Log Results] Exception: ${error?.message}`] },
      { status: 500 }
    );
  }
}
