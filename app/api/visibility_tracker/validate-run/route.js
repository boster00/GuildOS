/**
 * POST /api/visibility_tracker/validate-run
 * Step 6 — Validate Run Snapshot (spec).
 * Body: { run_id: string }
 * Returns: { success: true, run_id, status, summary: { jobs_expected, results_persisted, jobs_failed } }
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { validateRun } from "@/libs/visibility_tracker/runs/validate";

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
    const run_id = body.run_id;

    if (!run_id) {
      return NextResponse.json(
        { success: false, error: "RUN_ID_INVALID", message: "run_id is required" },
        { status: 400 }
      );
    }

    const logs = [];
    logs.push(`[Validate Run] Request: run_id=${run_id}`);
    const result = await validateRun(supabase, { run_id, logs });

    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      status: result.status,
      summary: result.summary,
      logs,
    });
  } catch (error) {
    const code = error?.message === "RUN_ID_INVALID" ? "RUN_ID_INVALID" : error?.message === "RUN_NOT_FOUND" ? "RUN_NOT_FOUND" : "VALIDATE_FAILED";
    const status = error?.message === "RUN_ID_INVALID" ? 400 : error?.message === "RUN_NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { success: false, error: code, message: error?.message || "Validate run failed", logs: [`[Validate Run] Exception: ${error?.message}`] },
      { status }
    );
  }
}
