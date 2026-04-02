import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { getDueProjects } from "@/libs/visibility_tracker/db";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const cronSecret =
    process.env.VT_CRON_SECRET || process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: cron secret not set" },
      { status: 500 }
    );
  }

  const valid =
    authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret;
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const dueProjects = await getDueProjects(supabase);
    const createdRuns = [];

    for (const project of dueProjects) {
      

      try {
        // Dedupe: reuse existing queued/running run for this project
        const { data: existingRun } = await supabase
          .from("vt_runs")
          .select("id")
          .eq("project_id", project.id)
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
          .limit(1);
        let run = existingRun?.[0];
        if (!run) {
          const { data: newRun, error: runError } = await supabase
            .from("vt_runs")
            .insert({
              project_id: project.id,
              run_type: "scheduled",
              status: "queued",
            })
            .select()
            .single();
          if (runError) {
            continue;
          }
          run = newRun;
        } else {
        }

        const { data: keywords } = await supabase
          .from("vt_keywords")
          .select("*")
          .eq("project_id", project.id)
          .eq("is_active", true);

        const { data: prompts } = await supabase
          .from("vt_prompts")
          .select("*")
          .eq("project_id", project.id)
          .eq("is_active", true);
        // Dedupe: fetch existing jobs for this run
        const { data: existingJobs } = await supabase
          .from("vt_jobs")
          .select("job_type, entity_id, metadata")
          .eq("run_id", run.id);
        const existingSet = new Set();
        (existingJobs || []).forEach((j) => {
          const key = j.job_type === "ai_prompt"
            ? `${j.job_type}:${j.entity_id}:${j.metadata?.model ?? "chatgpt"}`
            : `${j.job_type}:${j.entity_id}`;
          existingSet.add(key);
        });

        const keywordJobs = (keywords || []).filter((kw) => !existingSet.has(`serp_keyword:${kw.id}`)).map((kw) => ({
          run_id: run.id,
          job_type: "serp_keyword",
          entity_id: kw.id,
          status: "queued",
          metadata: { location: "US", device: "desktop", engine: "google" },
        }));
        const promptJobs = (prompts || []).flatMap((prompt) =>
          (prompt.models || ["chatgpt"]).map((model) => ({
            run_id: run.id,
            job_type: "ai_prompt",
            entity_id: prompt.id,
            status: "queued",
            metadata: { model },
          }))
        ).filter((j) => {
          const key = `ai_prompt:${j.entity_id}:${j.metadata.model}`;
          return !existingSet.has(key);
        });
        const allJobs = [...keywordJobs, ...promptJobs];
        if (allJobs.length > 0) {
          const { error: jobsError } = await supabase
            .from("vt_jobs")
            .insert(allJobs);

          if (jobsError) {
          } else {
            await supabase
              .from("vt_runs")
              .update({ status: "running" })
              .eq("id", run.id);
          }
        }

        createdRuns.push(run.id);
      } catch (projectError) {
      }
    }
    return NextResponse.json({
      success: true,
      projectsProcessed: dueProjects.length,
      runsCreated: createdRuns.length,
      runIds: createdRuns,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Cron tick failed" },
      { status: 500 }
    );
  }
}
