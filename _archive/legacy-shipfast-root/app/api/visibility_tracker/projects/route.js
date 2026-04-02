import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProjects } from "@/libs/visibility_tracker/db";

/**
 * GET /api/visibility_tracker/projects
 * Returns all projects for the current user with keyword_count and prompt_count.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: projects } = await getProjects(supabase, user.id);
    if (!projects?.length) {
      return NextResponse.json({ success: true, projects: [] });
    }

    const projectIds = projects.map((p) => p.id);

    const [kwRes, prRes] = await Promise.all([
      supabase
        .from("vt_keywords")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("is_active", true),
      supabase
        .from("vt_prompts")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("is_active", true),
    ]);

    const keywordCountByProject = {};
    const promptCountByProject = {};
    projectIds.forEach((id) => {
      keywordCountByProject[id] = 0;
      promptCountByProject[id] = 0;
    });
    (kwRes.data || []).forEach((r) => {
      keywordCountByProject[r.project_id] = (keywordCountByProject[r.project_id] || 0) + 1;
    });
    (prRes.data || []).forEach((r) => {
      promptCountByProject[r.project_id] = (promptCountByProject[r.project_id] || 0) + 1;
    });

    const projectsWithCounts = projects.map((p) => ({
      ...p,
      keyword_count: keywordCountByProject[p.id] ?? 0,
      prompt_count: promptCountByProject[p.id] ?? 0,
    }));

    return NextResponse.json({ success: true, projects: projectsWithCounts });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
