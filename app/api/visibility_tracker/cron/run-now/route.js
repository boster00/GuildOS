import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { schedule } from "@/libs/visibility_tracker/scheduler/schedule";

/**
 * POST /api/visibility_tracker/cron/run-now
 * Schedules runs and jobs for all of the current user's projects, then triggers
 * the VT worker once so jobs start processing. Auth required; no cron secret.
 */
export async function POST(request) {
  const logs = [];
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const result = await schedule(
      supabase,
      { source: "user" },
      user.id,
      logs
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
          logs,
        },
        { status: result.error === "USER_REQUIRED" ? 400 : 500 }
      );
    }

    const jobsCreated = result.jobs_created ?? 0;
    const runIds = result.run_ids ?? [];

    let workerTriggered = false;
    let workerError = null;
    if (jobsCreated > 0) {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000";
      const workerSecret =
        process.env.VT_WORKER_SECRET ||
        process.env.WORKER_SECRET ||
        process.env.CRON_SECRET;
      if (workerSecret) {
        try {
          const workerRes = await fetch(
            `${origin}/api/visibility_tracker/worker/poll`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${workerSecret}`,
              },
              body: JSON.stringify({
                workerId: "run-now-trigger",
                batchSize: 10,
              }),
            }
          );
          workerTriggered = workerRes.ok;
          if (!workerRes.ok) {
            const errData = await workerRes.json().catch(() => ({}));
            workerError = errData?.error || workerRes.statusText;
          }
        } catch (e) {
          workerError = e?.message || "Fetch failed";
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobs_created: jobsCreated,
      run_ids: runIds,
      worker_triggered: workerTriggered,
      ...(workerError && { worker_error: workerError }),
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: error?.message || "Run now failed",
        logs,
      },
      { status: 500 }
    );
  }
}
