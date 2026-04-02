/**
 * POST /api/visibility_tracker/assign
 * Step 2 — Assign Jobs (spec).
 * Body: { run_id?: string, worker_id: string, batch_size?: number }
 * Returns: { success: true, assigned_jobs: [{ job_id, job_type, metadata }] } or error.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { assignJobs } from "@/libs/visibility_tracker/worker/assign";

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

    const { run_id, worker_id, batch_size } = body;
    if (!worker_id) {
      return NextResponse.json(
        { success: false, error: "WORKER_ID_REQUIRED", message: "worker_id is required" },
        { status: 400 }
      );
    }

    const logs = [];
    logs.push(`[Assign] Request: run_id=${run_id ?? "none"}, worker_id=${worker_id}, batch_size=${batch_size ?? 5}`);
    const result = await assignJobs(supabase, { run_id, worker_id, batch_size, logs });

    return NextResponse.json({
      success: true,
      assigned_jobs: result.assigned_jobs,
      logs,
    });
  } catch (error) {
    const code = error?.message === "RUN_ID_INVALID" ? "RUN_ID_INVALID" : "ASSIGN_FAILED";
    return NextResponse.json(
      { success: false, error: code, message: error?.message || "Assign failed", logs: [`[Assign] Exception: ${error?.message}`] },
      { status: 500 }
    );
  }
}
