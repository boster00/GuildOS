import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

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
      .select("id, project_id")
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

    const { data: results } = await supabase
      .from("vt_ai_results")
      .select("*, vt_prompts(id, prompt_text)")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    const domain = project.domain;
    const resultsWithDomain = (results || []).map((r) => ({
      ...r,
      domain,
    }));

    return NextResponse.json({
      success: true,
      results: resultsWithDomain,
      domain,
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
