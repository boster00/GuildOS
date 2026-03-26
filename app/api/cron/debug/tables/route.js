/**
 * GET /api/cron/debug/tables
 * Returns all visibility tracker (vt_*) table rows: vt_projects, vt_keywords, vt_prompts, vt_runs, vt_jobs, vt_serp_results, vt_ai_results.
 * Auth: x-cron-secret header must match CRON_SECRET (same as trigger).
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";

export async function GET(request) {
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

    const [
      vt_projects_res,
      vt_keywords_res,
      vt_prompts_res,
      vt_runs_res,
      vt_jobs_res,
      vt_serp_results_res,
      vt_ai_results_res,
    ] = await Promise.all([
      supabase.from("vt_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_keywords").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_prompts").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_serp_results").select("*").order("created_at", { ascending: false }),
      supabase.from("vt_ai_results").select("*").order("created_at", { ascending: false }),
    ]);

    const queries = [
      { key: "vt_projects", res: vt_projects_res },
      { key: "vt_keywords", res: vt_keywords_res },
      { key: "vt_prompts", res: vt_prompts_res },
      { key: "vt_runs", res: vt_runs_res },
      { key: "vt_jobs", res: vt_jobs_res },
      { key: "vt_serp_results", res: vt_serp_results_res },
      { key: "vt_ai_results", res: vt_ai_results_res },
    ];
    const _errors = {};
    const payload = {};
    for (const { key, res } of queries) {
      if (res.error) {
        _errors[key] = res.error.message || String(res.error);
        payload[key] = [];
      } else {
        payload[key] = res.data ?? [];
      }
    }
    if (Object.keys(_errors).length > 0) {
      payload._errors = _errors;
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
