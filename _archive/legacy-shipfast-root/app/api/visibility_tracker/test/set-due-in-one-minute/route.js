import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { getProject, getProjectById } from "@/libs/visibility_tracker/db";

export const dynamic = "force-dynamic";

const CADENCE_HOURS = {
  weekly: 168,
  daily: 24,
  "2xdaily": 12,
};

/**
 * POST /api/visibility_tracker/test/set-due-in-one-minute
 * Body: { projectId?: string }
 * Sets vt_projects.last_run_at so the project becomes due in ~1 minute (by getDueProjects).
 * Auth required. Same env guard as test-production (not in production or ALLOW_TEST_PRODUCTION).
 */
export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" ||
    process.env.ALLOW_TEST_PRODUCTION === "1";
  if (isProduction && !allowTestProduction) {
    return NextResponse.json({ error: "Not allowed in this environment" }, { status: 404 });
  }

  let body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const projectId = body.projectId && String(body.projectId).trim() || null;

  const project = projectId
    ? (await getProjectById(supabase, user.id, projectId)).data
    : (await getProject(supabase, user.id)).data;

  if (!project) {
    return NextResponse.json(
      projectId ? { error: "Project not found" } : { error: "No project found" },
      { status: 404 }
    );
  }

  const cadence = project.cadence || "weekly";
  const cadenceHours = CADENCE_HOURS[cadence] ?? 168;
  // Due in ~1 minute: last_run_at = now - (cadence_hours - 1/60) hours
  const hoursAgo = cadenceHours - 1 / 60;
  const lastRunAt = new Date(
    Date.now() - hoursAgo * 60 * 60 * 1000
  ).toISOString();

  const serviceSupabase = createServiceRoleClient();
  const { error } = await serviceSupabase
    .from("vt_projects")
    .update({ last_run_at: lastRunAt })
    .eq("id", project.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    projectId: project.id,
    last_run_at: lastRunAt,
    cadence,
    dueInAboutOneMinute: true,
  });
}
