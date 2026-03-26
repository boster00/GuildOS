import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const runId = params?.runId;
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
      .select("user_id")
      .eq("id", run.project_id)
      .single();

    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const { data: jobs } = await supabase
      .from("vt_jobs")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    const stats = {
      total: jobs?.length || 0,
      queued: jobs?.filter((j) => j.status === "queued").length || 0,
      assigned: jobs?.filter((j) => j.status === "assigned").length || 0,
      processing: jobs?.filter((j) => j.status === "processing").length || 0,
      completed: jobs?.filter((j) => j.status === "completed").length || 0,
      failed: jobs?.filter((j) => j.status === "failed").length || 0,
    };
    return NextResponse.json({
      success: true,
      jobs: jobs || [],
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
