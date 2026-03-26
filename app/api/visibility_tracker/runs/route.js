import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProjects, getProjectById } from "@/libs/visibility_tracker/db";

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
    const projectId = searchParams.get("projectId");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10) || 20,
      100
    );

    if (projectId) {
      const { data: project } = await getProjectById(supabase, user.id, projectId);
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const { data: runs } = await supabase
        .from("vt_runs")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      return NextResponse.json({ success: true, runs: runs || [] });
    }

    const { data: projects } = await getProjects(supabase, user.id);
    if (!projects?.length) {
      return NextResponse.json({ success: true, runs: [] });
    }

    const projectIds = projects.map((p) => p.id);
    const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

    const { data: runs } = await supabase
      .from("vt_runs")
      .select("*")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    const runsWithDomain = (runs || []).map((r) => ({
      ...r,
      domain: projectById[r.project_id]?.domain ?? null,
    }));

    return NextResponse.json({ success: true, runs: runsWithDomain });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
