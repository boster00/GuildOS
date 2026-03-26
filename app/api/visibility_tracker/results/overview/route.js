import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import {
  calculateSeoVisibility,
  calculateAiVisibility,
} from "@/libs/visibility_tracker/scoring";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }
    const { data: run } = await supabase
      .from("vt_runs")
      .select("id, project_id, finished_at, started_at, status")
      .eq("id", runId)
      .single();

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const { data: project } = await supabase
      .from("vt_projects")
      .select("user_id, domain")
      .eq("id", run.project_id)
      .single();

    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const domain = project.domain;

    const { data: serpResults } = await supabase
      .from("vt_serp_results")
      .select("*")
      .eq("run_id", runId);

    const { data: aiResults } = await supabase
      .from("vt_ai_results")
      .select("*")
      .eq("run_id", runId);

    const seoVisibility = calculateSeoVisibility(serpResults || []);
    const aiVisibility = calculateAiVisibility(aiResults || [], domain);
    return NextResponse.json({
      success: true,
      overview: {
        seoVisibility,
        aiVisibility,
        trackedKeywords: serpResults?.length || 0,
        trackedPrompts: aiResults?.length || 0,
        lastRun: run.finished_at || run.started_at,
        runStatus: run.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
