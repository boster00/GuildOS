import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import {
  getProject,
  getProjectById,
  createRun,
  getKeywords,
  getPrompts,
} from "@/libs/visibility_tracker/db";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch {
      // optional body
    }
    const projectId = body.projectId;

    const project = projectId
      ? (await getProjectById(supabase, user.id, projectId)).data
      : (await getProject(supabase, user.id)).data;
    if (!project) {
      return NextResponse.json(
        projectId ? { error: "Project not found" } : { error: "No project found" },
        { status: 404 }
      );
    }

    const { data: keywords } = await getKeywords(supabase, project.id);
    const { data: prompts } = await getPrompts(supabase, project.id);

    const kwList = keywords || [];
    const prList = prompts || [];
    if (kwList.length > 20) {
      return NextResponse.json(
        {
          error: "Maximum 20 keywords allowed",
          current: kwList.length,
          limit: 20,
        },
        { status: 400 }
      );
    }

    if (prList.length > 5) {
      return NextResponse.json(
        {
          error: "Maximum 5 prompts allowed",
          current: prList.length,
          limit: 5,
        },
        { status: 400 }
      );
    }

    const { data: run, error: runError } = await createRun(
      supabase,
      project.id,
      "manual",
      user.id
    );
    if (runError) {
      throw runError;
    }
    const keywordJobs = kwList.map((kw) => ({
      run_id: run.id,
      job_type: "serp_keyword",
      entity_id: kw.id,
      status: "queued",
      metadata: { location: "US", device: "desktop", engine: "google" },
    }));

    const promptJobs = prList.flatMap((prompt) =>
      (prompt.models || ["chatgpt"]).map((model) => ({
        run_id: run.id,
        job_type: "ai_prompt",
        entity_id: prompt.id,
        status: "queued",
        metadata: { model },
      }))
    );

    const allJobs = [...keywordJobs, ...promptJobs];

    // vt_jobs has no user INSERT policy; use service role for job insert and run updates
    const serviceSupabase = createServiceRoleClient();

    if (allJobs.length > 0) {
      const { error: jobsError } = await serviceSupabase
        .from("vt_jobs")
        .insert(allJobs);

      if (jobsError) {
        throw jobsError;
      }

      

      await serviceSupabase
        .from("vt_runs")
        .update({ status: "running" })
        .eq("id", run.id);
    }

    const estimatedCost = keywordJobs.length * 1 + promptJobs.length * 5;
    await serviceSupabase
      .from("vt_runs")
      .update({ cost_units: estimatedCost })
      .eq("id", run.id);
    return NextResponse.json({
      success: true,
      runId: run.id,
      jobCount: allJobs.length,
      keywordJobs: keywordJobs.length,
      promptJobs: promptJobs.length,
      estimatedCost,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
