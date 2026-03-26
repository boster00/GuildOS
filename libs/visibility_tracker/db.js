/**
 * Visibility Tracker DAL - lightweight query helpers for vt_* tables.
 * Uses direct Supabase client (no ORM).
 */

export async function getProject(supabase, userId) {
  const { data, error } = await supabase
    .from("vt_projects")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {

    throw error;
  }
  return { data, error };
}

/** All projects for a user (for listing). */
export async function getProjects(supabase, userId) {
  const { data, error } = await supabase
    .from("vt_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {

    throw error;
  }
  return { data: data || [], error };
}

/** Single project by id; only returns if user owns it. */
export async function getProjectById(supabase, userId, projectId) {
  const { data, error } = await supabase
    .from("vt_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {

    throw error;
  }
  return { data, error };
}

/** Last N runs for a project (by created_at desc). */
export async function getLastRunsForProject(supabase, projectId, limit = 10) {
  const { data, error } = await supabase
    .from("vt_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {

    throw error;
  }
  return { data: data || [], error };
}

/** Active run for a project (queued or running), if any. */
export async function getActiveRunForProject(supabase, projectId) {
  const { data, error } = await supabase
    .from("vt_runs")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {

    throw error;
  }
  return { data: data || null, error };
}

/** SEO result summaries for a run (keyword text from vt_keywords). */
export async function getSerpResultSummaries(supabase, runId) {
  const { data, error } = await supabase
    .from("vt_serp_results")
    .select("keyword_id, rank, best_url, engine, vt_keywords(keyword)")
    .eq("run_id", runId);
  if (error) {

    throw error;
  }
  return { data: data || [], error };
}

/** AI result summaries for a run (prompt_text from vt_prompts). */
export async function getAiResultSummaries(supabase, runId) {
  const { data, error } = await supabase
    .from("vt_ai_results")
    .select("prompt_id, model, mentions_brand, mentions_domain, citations, vt_prompts(prompt_text)")
    .eq("run_id", runId);
  if (error) {

    throw error;
  }
  return { data: data || [], error };
}

export async function getKeywords(supabase, projectId) {
  const { data, error } = await supabase
    .from("vt_keywords")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true);
  if (error) {

    throw error;
  }
  return { data, error };
}

export async function getPrompts(supabase, projectId) {
  const { data, error } = await supabase
    .from("vt_prompts")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true);
  if (error) {

    throw error;
  }
  return { data, error };
}

export async function createRun(supabase, projectId, runType, userId = null) {
  const { data, error } = await supabase
    .from("vt_runs")
    .insert({
      project_id: projectId,
      run_type: runType,
      requested_by_user_id: userId,
      status: "queued",
    })
    .select()
    .single();
  if (error) {

    throw error;
  }
  return { data, error };
}

export async function claimJobs(supabase, workerId, batchSize = 10) {

  const { data: jobs, error } = await supabase.rpc("claim_vt_jobs", {
    p_worker_id: workerId,
    p_batch_size: batchSize,
  });
  if (error) {

    throw error;
  }

  return jobs;
}

export async function finalizeRun(supabase, runId) {

  const { data: jobs, error: jobsError } = await supabase
    .from("vt_jobs")
    .select("status")
    .eq("run_id", runId);

  if (jobsError) {

    throw jobsError;
  }

  const total = jobs?.length || 0;
  const completed = jobs?.filter((j) => j.status === "completed").length || 0;
  const failed = jobs?.filter((j) => j.status === "failed").length || 0;

  let runStatus = "success";
  if (failed === total) runStatus = "failed";
  else if (failed > 0) runStatus = "partial";

  const errorSummary =
    failed > 0
      ? `${failed} job(s) failed`
      : total === 0
        ? "No jobs"
        : null;

  const { data: run, error: runError } = await supabase
    .from("vt_runs")
    .update({
      status: runStatus,
      finished_at: new Date().toISOString(),
      ...(errorSummary && { error_summary: errorSummary }),
    })
    .eq("id", runId)
    .select("project_id")
    .single();

  if (runError) {

    throw runError;
  }

  if (run?.project_id) {
    await supabase
      .from("vt_projects")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: runStatus,
      })
      .eq("id", run.project_id);
  }

  return { status: runStatus, total, completed, failed };
}

export async function getDueProjects(supabase) {

  const { data: projects, error } = await supabase
    .from("vt_projects")
    .select("*");

  if (error) {

    throw error;
  }

  const now = new Date();
  const dueProjects = (projects || []).filter((project) => {
    if (!project.last_run_at) return true;

    const lastRun = new Date(project.last_run_at);
    const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

    switch (project.cadence) {
      case "daily":
        return hoursSinceLastRun >= 24;
      case "2xdaily":
        return hoursSinceLastRun >= 12;
      case "weekly":
      default:
        return hoursSinceLastRun >= 168;
    }
  });

  return dueProjects;
}
