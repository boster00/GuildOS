/**
 * GET /api/visibility_tracker/debug/tables
 * Returns all vt_* table rows for the current user's project(s) as JSON.
 * Auth: same as other VT APIs (authenticated user). Optional: restrict to dev.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProject } from "@/libs/visibility_tracker/db";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await getProject(supabase, user.id);
    if (!project) {
      return NextResponse.json({
        vt_projects: [],
        vt_keywords: [],
        vt_prompts: [],
        vt_runs: [],
        vt_jobs: [],
        vt_serp_results: [],
        vt_ai_results: [],
      });
    }

    const projectId = project.id;

    const [
      { data: projects },
      { data: keywords },
      { data: prompts },
      { data: runs },
    ] = await Promise.all([
      supabase.from("vt_projects").select("*").eq("id", projectId),
      supabase.from("vt_keywords").select("*").eq("project_id", projectId),
      supabase.from("vt_prompts").select("*").eq("project_id", projectId),
      supabase.from("vt_runs").select("id").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    const runIds = (runs || []).map((r) => r.id);
    let jobsList = [];
    let serpList = [];
    let aiList = [];
    if (runIds.length > 0) {
      const [j, s, a] = await Promise.all([
        supabase.from("vt_jobs").select("*").in("run_id", runIds).order("created_at", { ascending: false }),
        supabase.from("vt_serp_results").select("*").in("run_id", runIds).order("created_at", { ascending: false }),
        supabase.from("vt_ai_results").select("*").in("run_id", runIds).order("created_at", { ascending: false }),
      ]);
      jobsList = j.data || [];
      serpList = s.data || [];
      aiList = a.data || [];
    }

    const runsFull = await supabase
      .from("vt_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const runsData = runsFull.data || [];

    return NextResponse.json({
      vt_projects: projects || [],
      vt_keywords: keywords || [],
      vt_prompts: prompts || [],
      vt_runs: runsData,
      vt_jobs: jobsList,
      vt_serp_results: serpList,
      vt_ai_results: aiList,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
