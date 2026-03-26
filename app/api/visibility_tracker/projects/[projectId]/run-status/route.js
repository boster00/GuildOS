import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProjectById, getActiveRunForProject } from "@/libs/visibility_tracker/db";

/**
 * GET /api/visibility_tracker/projects/[projectId]/run-status
 * Returns whether the project has an active run (queued or running).
 * Auth: project must belong to current user.
 */
export async function GET(request, { params }) {
  try {
    const projectId = params?.projectId;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await getProjectById(supabase, user.id, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: run } = await getActiveRunForProject(supabase, projectId);
    if (run) {
      return NextResponse.json({
        active: true,
        run_id: run.id,
        status: run.status,
      });
    }
    return NextResponse.json({ active: false });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
