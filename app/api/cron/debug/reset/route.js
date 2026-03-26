/**
 * POST /api/cron/debug/reset
 * Empties VT result/run tables only. vt_projects, vt_keywords, vt_prompts are preserved.
 * Auth: x-cron-secret header must match CRON_SECRET.
 * Returns: { success, cleared: { vt_ai_results, vt_serp_results, vt_jobs, vt_runs } }
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";

export async function POST(request) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 500 }
    );
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();

    const deleteTable = async (table) => {
      const { count, error } = await supabase
        .from(table)
        .delete()
        .not("id", "is", null)
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    };

    // Order respects FKs: children before parents. Config tables (vt_projects, vt_keywords, vt_prompts) are not cleared.
    const cleared = {
      vt_ai_results: await deleteTable("vt_ai_results"),
      vt_serp_results: await deleteTable("vt_serp_results"),
      vt_jobs: await deleteTable("vt_jobs"),
      vt_runs: await deleteTable("vt_runs"),
    };

    return NextResponse.json({ success: true, cleared });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message, success: false },
      { status: 500 }
    );
  }
}
