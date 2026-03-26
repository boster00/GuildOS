/**
 * Visibility Tracker - Schedule step: create run + jobs from demo_contract or DB.
 * Returns { success, run_id, jobs_created, job_ids, error? } per spec.
 */

import { getDueProjects, getProjects } from "../db.js";

const DEMO_RUN_TYPE = "manual";
const DB_RUN_TYPE = "scheduled";

/**
 * Resolve a user id for demo (same logic as cron getOrCreateDemoProject).
 */
async function resolveDemoUserId(supabase) {
  if (process.env.CRON_DEMO_USER_ID) return process.env.CRON_DEMO_USER_ID;
  const { data: fromVt } = await supabase.from("vt_projects").select("user_id").limit(1).maybeSingle();
  if (fromVt?.user_id) return fromVt.user_id;
  try {
    const { data: fromProfiles } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    if (fromProfiles?.id) return fromProfiles.id;
  } catch (_) {}
  try {
    const { data: fromIcps } = await supabase.from("icps").select("user_id").limit(1).maybeSingle();
    if (fromIcps?.user_id) return fromIcps.user_id;
  } catch (_) {}
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1 });
    const first = authData?.users?.[0];
    if (first?.id) return first.id;
  } catch (_) {}
  return null;
}

/**
 * Get or create vt_projects row for demo (by domain).
 */
async function getOrCreateProjectForDemo(supabase, domain, userId) {
  const { data: existing } = await supabase
    .from("vt_projects")
    .select("id")
    .eq("user_id", userId)
    .eq("domain", domain || "cron-demo.local")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("vt_projects")
    .insert({
      user_id: userId,
      domain: domain || "cron-demo.local",
      cadence: "weekly",
    })
    .select("id")
    .single();
  if (error) {

    return null;
  }
  return created?.id || null;
}

/**
 * Schedule from demo_contract: one run, keywords → serp_keyword jobs, prompts → ai_prompt per model.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ domain: string, keywords: string[], prompts: Array<{ text: string, models?: string[] }>, ai_provider?: string }} demo_contract
 * @param {string} run_type - e.g. 'manual' or 'test'
 * @param {string} [requestedByUserId] - optional user id for run
 * @param {string[]} [logs] - optional array to push log lines
 */
export async function scheduleFromDemo(supabase, demo_contract, run_type = DEMO_RUN_TYPE, requestedByUserId = null, logs = null) {
  const L = (msg) => {
    if (Array.isArray(logs)) logs.push(msg);
  };
  const userId = requestedByUserId || (await resolveDemoUserId(supabase));
  if (!userId) {
    return { success: false, error: "PROJECT_NOT_FOUND", message: "No user for demo. Set CRON_DEMO_USER_ID or ensure vt_projects/profiles exist." };
  }
  const domain = (demo_contract?.domain && String(demo_contract.domain).trim()) || "cron-demo.local";
  const projectId = await getOrCreateProjectForDemo(supabase, domain, userId);
  if (!projectId) {
    return { success: false, error: "RUN_CREATE_FAILED", message: "Could not get or create project." };
  }

  // Dedupe run: reuse existing queued/running run for this project
  const { data: existingRunList } = await supabase
    .from("vt_runs")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1);
  let runId = existingRunList?.[0]?.id;
  if (!runId) {
    const { data: run, error: runErr } = await supabase
      .from("vt_runs")
      .insert({
        project_id: projectId,
        run_type: run_type === "test" ? "manual" : run_type,
        status: "queued",
        requested_by_user_id: requestedByUserId || userId,
      })
      .select("id")
      .single();
    if (runErr || !run?.id) {
      return { success: false, error: "RUN_CREATE_FAILED", message: runErr?.message || "Failed to create run." };
    }
    runId = run.id;
    L("Created new run");
  } else {
    L(`Reusing existing run id=${runId}`);
  }
  const jobIds = [];
  const now = new Date().toISOString();

  const keywords = Array.isArray(demo_contract?.keywords) ? demo_contract.keywords : [];
  const prompts = Array.isArray(demo_contract?.prompts) ? demo_contract.prompts : [];
  const promptModels = prompts.reduce((acc, p) => acc + (Array.isArray(p?.models) ? p.models.length : 1), 0);
  L(`Jobs interpreted: ${keywords.length} keywords → serp_keyword, ${prompts.length} prompts × models → ai_prompt (${promptModels} ai_prompt jobs)`);

  for (const kw of keywords) {
    const keywordText = typeof kw === "string" ? kw : (kw?.keyword || kw?.text || "");
    const trimmed = keywordText.trim();
    if (!trimmed) continue;
    // Dedupe: get existing or create (one keyword per project)
    let kwRow = null;
    const { data: existingList } = await supabase
      .from("vt_keywords")
      .select("id")
      .eq("project_id", projectId)
      .eq("keyword", trimmed)
      .limit(1);
    const existingKw = existingList?.[0];
    if (existingKw?.id) {
      kwRow = existingKw;
      L(`Keyword "${trimmed.slice(0, 40)}..." → using existing id=${kwRow.id}`);
    } else {
      const { data: inserted, error: kwErr } = await supabase
        .from("vt_keywords")
        .insert({ project_id: projectId, keyword: trimmed, is_active: true })
        .select("id")
        .single();
      if (kwErr) { L(`Adding serp_keyword job for "${trimmed.slice(0, 40)}..." → skip (keyword insert failed)`); continue; }
      kwRow = inserted;
    }
    // Dedupe job: skip if (run_id, job_type, entity_id) already exists
    const { data: existingJob } = await supabase
      .from("vt_jobs")
      .select("id")
      .eq("run_id", runId)
      .eq("job_type", "serp_keyword")
      .eq("entity_id", kwRow.id)
      .limit(1);
    if (existingJob?.[0]?.id) {
      L(`serp_keyword for "${keywordText.slice(0, 40)}..." → skip (duplicate job)`);
      continue;
    }
    const { data: jobRow, error: jobErr } = await supabase
      .from("vt_jobs")
      .insert({
        run_id: runId,
        job_type: "serp_keyword",
        entity_id: kwRow.id,
        status: "queued",
        attempts: 0,
        max_retries: 3,
        metadata: { engine: "google", location: "US", device: "desktop", scheduledAt: now },
      })
      .select("id")
      .single();
    L(!jobErr && jobRow?.id ? `Adding serp_keyword job for "${keywordText.slice(0, 40)}..." → job_id=${jobRow.id} (ok)` : `Adding serp_keyword job for "${keywordText.slice(0, 40)}..." → skip (job insert failed: ${jobErr?.message ?? "unknown"})`);
    if (!jobErr && jobRow?.id) jobIds.push(jobRow.id);
  }

  for (const p of prompts) {
    const text = (p?.text && String(p.text).trim()) || "";
    const models = Array.isArray(p?.models) ? p.models : ["chatgpt"];
    if (!text) continue;
    // Dedupe: get existing or create (one prompt per project + text)
    let promptRow = null;
    const { data: existingPromptList } = await supabase
      .from("vt_prompts")
      .select("id")
      .eq("project_id", projectId)
      .eq("prompt_text", text)
      .limit(1);
    const existingPrompt = existingPromptList?.[0];
    if (existingPrompt?.id) {
      promptRow = existingPrompt;
      L(`Prompt "${text.slice(0, 30)}..." → using existing id=${promptRow.id}`);
    } else {
      const { data: inserted, error: promptErr } = await supabase
        .from("vt_prompts")
        .insert({
          project_id: projectId,
          prompt_text: text,
          models: models,
          is_active: true,
        })
        .select("id")
        .single();
      if (promptErr) { L(`Adding ai_prompt job for "${text.slice(0, 30)}..." → skip (prompt insert failed)`); continue; }
      promptRow = inserted;
    }
    for (const model of models) {
      // Dedupe job: skip if (run_id, job_type, entity_id, model) already exists
      const { data: existingJobs } = await supabase
        .from("vt_jobs")
        .select("id, metadata")
        .eq("run_id", runId)
        .eq("job_type", "ai_prompt")
        .eq("entity_id", promptRow.id);
      const duplicate = (existingJobs || []).find((j) => j.metadata?.model === model);
      if (duplicate?.id) {
        L(`ai_prompt model ${model} → skip (duplicate job)`);
        continue;
      }
      const { data: jobRow, error: jobErr } = await supabase
        .from("vt_jobs")
        .insert({
          run_id: runId,
          job_type: "ai_prompt",
          entity_id: promptRow.id,
          status: "queued",
          attempts: 0,
          max_retries: 3,
          metadata: { model, scheduledAt: now },
        })
        .select("id")
        .single();
      L(!jobErr && jobRow?.id ? `Adding ai_prompt job for model ${model} → job_id=${jobRow.id} (ok)` : `Adding ai_prompt job for model ${model} → skip (job insert failed: ${jobErr?.message ?? "unknown"})`);
      if (!jobErr && jobRow?.id) jobIds.push(jobRow.id);
    }
  }

  L(`Total jobs created: ${jobIds.length}`);
  if (jobIds.length > 0) {
    await supabase.from("vt_runs").update({ status: "running" }).eq("id", runId);
  }

  return {
    success: true,
    run_id: runId,
    jobs_created: jobIds.length,
    job_ids: jobIds,
  };
}

/**
 * Schedule from DB: all due projects (cadence + last_run_at), create run + jobs per project.
 * Returns aggregate counts for backward compatibility with cron trigger.
 * @param {string[]} [logs] - optional array to push log lines
 */
export async function scheduleFromDb(supabase, logs = null) {
  const L = (msg) => {
    if (Array.isArray(logs)) logs.push(msg);
  };
  const dueProjects = await getDueProjects(supabase);
  if (dueProjects.length === 0) {
    L("No due projects; no jobs created.");
    return { success: true, run_id: null, jobs_created: 0, job_ids: [] };
  }

  let totalJobsCreated = 0;
  const allJobIds = [];
  let firstRunId = null;

  for (const project of dueProjects) {
    try {
      L(`Processing due project ${project.id} (cadence: ${project.cadence})`);

      // Dedupe run: reuse existing queued/running run for this project
      const { data: existingRunList } = await supabase
        .from("vt_runs")
        .select("id")
        .eq("project_id", project.id)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1);
      let runId = existingRunList?.[0]?.id;
      if (!runId) {
        const { data: run, error: runError } = await supabase
          .from("vt_runs")
          .insert({
            project_id: project.id,
            run_type: DB_RUN_TYPE,
            status: "queued",
          })
          .select("id")
          .single();
        if (runError || !run?.id) {
          L(`Project ${project.id}: run create failed: ${runError?.message}`);
          continue;
        }
        runId = run.id;
        L(`Created run ${runId} for project ${project.id}`);
      } else {
        L(`Reusing existing run id=${runId} for project ${project.id}`);
      }
      if (!firstRunId) firstRunId = runId;

      const { data: keywords } = await supabase
        .from("vt_keywords")
        .select("id")
        .eq("project_id", project.id)
        .eq("is_active", true);
      const { data: prompts } = await supabase
        .from("vt_prompts")
        .select("id, models")
        .eq("project_id", project.id)
        .eq("is_active", true);

      // Dedupe: fetch existing jobs for this run and filter out duplicates
      const { data: existingJobs } = await supabase
        .from("vt_jobs")
        .select("job_type, entity_id, metadata")
        .eq("run_id", runId);
      const existingSet = new Set();
      (existingJobs || []).forEach((j) => {
        const key = j.job_type === "ai_prompt"
          ? `${j.job_type}:${j.entity_id}:${j.metadata?.model ?? "chatgpt"}`
          : `${j.job_type}:${j.entity_id}`;
        existingSet.add(key);
      });

      const keywordJobs = (keywords || []).filter((kw) => {
        const key = `serp_keyword:${kw.id}`;
        return !existingSet.has(key);
      }).map((kw) => ({
        run_id: runId,
        job_type: "serp_keyword",
        entity_id: kw.id,
        status: "queued",
        metadata: { location: "US", device: "desktop", engine: "google" },
      }));
      const promptJobsBatch = (prompts || []).flatMap((prompt) =>
        (prompt.models || ["chatgpt"]).map((model) => ({
          run_id: runId,
          job_type: "ai_prompt",
          entity_id: prompt.id,
          status: "queued",
          metadata: { model },
        }))
      );
      const promptJobs = promptJobsBatch.filter((j) => {
        const key = `ai_prompt:${j.entity_id}:${j.metadata.model}`;
        if (existingSet.has(key)) return false;
        existingSet.add(key);
        return true;
      });
      const allJobs = [...keywordJobs, ...promptJobs];

      if (allJobs.length > 0) {
        const { data: inserted, error: jobsError } = await supabase.from("vt_jobs").insert(allJobs).select("id");
        if (jobsError) {
          L(`Project ${project.id}: job insert failed: ${jobsError.message}`);
          continue;
        }
        const jobIds = (inserted || []).map((j) => j.id);
        totalJobsCreated += jobIds.length;
        allJobIds.push(...jobIds);
        L(`Created ${jobIds.length} jobs for run ${runId} (project ${project.id})`);
        await supabase.from("vt_runs").update({ status: "running" }).eq("id", runId);
      }
    } catch (err) {
      L(`Project ${project.id}: error: ${err?.message}`);
    }
  }

  L(`Total: ${dueProjects.length} due projects, ${totalJobsCreated} jobs created`);
  return {
    success: true,
    run_id: firstRunId,
    jobs_created: totalJobsCreated,
    job_ids: allJobIds,
  };
}

/**
 * Schedule for one user: all their projects, create or reuse runs and jobs.
 * @param {object} supabase - Supabase client (service role)
 * @param {string} userId - User id
 * @param {string[]} [logs] - optional array to push log lines
 */
export async function scheduleForUser(supabase, userId, logs = null) {
  const L = (msg) => {
    if (Array.isArray(logs)) logs.push(msg);
  };
  const { data: projects } = await getProjects(supabase, userId);
  if (!projects?.length) {
    L("No projects for user; no jobs created.");
    return { success: true, jobs_created: 0, run_ids: [] };
  }

  let totalJobsCreated = 0;
  const runIds = [];

  for (const project of projects) {
    const { data: existingRunList } = await supabase
      .from("vt_runs")
      .select("id")
      .eq("project_id", project.id)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1);
    let runId = existingRunList?.[0]?.id;
    if (!runId) {
      const { data: run, error: runError } = await supabase
        .from("vt_runs")
        .insert({
          project_id: project.id,
          run_type: "manual",
          status: "queued",
          requested_by_user_id: userId,
        })
        .select("id")
        .single();
      if (runError || !run?.id) {
        L(`Project ${project.id}: run create failed: ${runError?.message}`);
        continue;
      }
      runId = run.id;
      runIds.push(runId);
    } else {
      runIds.push(runId);
    }

    const { data: keywords } = await supabase
      .from("vt_keywords")
      .select("id")
      .eq("project_id", project.id)
      .eq("is_active", true);
    const { data: prompts } = await supabase
      .from("vt_prompts")
      .select("id, models")
      .eq("project_id", project.id)
      .eq("is_active", true);

    const { data: existingJobs } = await supabase
      .from("vt_jobs")
      .select("job_type, entity_id, metadata")
      .eq("run_id", runId);
    const existingSet = new Set();
    (existingJobs || []).forEach((j) => {
      const key = j.job_type === "ai_prompt"
        ? `${j.job_type}:${j.entity_id}:${j.metadata?.model ?? "chatgpt"}`
        : `${j.job_type}:${j.entity_id}`;
      existingSet.add(key);
    });

    const keywordJobs = (keywords || []).filter((kw) => {
      const key = `serp_keyword:${kw.id}`;
      return !existingSet.has(key);
    }).map((kw) => ({
      run_id: runId,
      job_type: "serp_keyword",
      entity_id: kw.id,
      status: "queued",
      metadata: { location: "US", device: "desktop", engine: "google" },
    }));
    const promptJobsBatch = (prompts || []).flatMap((prompt) =>
      (prompt.models || ["chatgpt"]).map((model) => ({
        run_id: runId,
        job_type: "ai_prompt",
        entity_id: prompt.id,
        status: "queued",
        metadata: { model },
      }))
    );
    const promptJobs = promptJobsBatch.filter((j) => {
      const key = `ai_prompt:${j.entity_id}:${j.metadata.model}`;
      if (existingSet.has(key)) return false;
      existingSet.add(key);
      return true;
    });
    const allJobs = [...keywordJobs, ...promptJobs];
    if (allJobs.length > 0) {
      const { data: inserted, error: jobsError } = await supabase.from("vt_jobs").insert(allJobs).select("id");
      if (jobsError) {
        L(`Project ${project.id}: job insert failed: ${jobsError.message}`);
        continue;
      }
      totalJobsCreated += (inserted || []).length;
      await supabase.from("vt_runs").update({ status: "running" }).eq("id", runId);
    }
  }

  L(`scheduleForUser: ${runIds.length} run(s), ${totalJobsCreated} jobs created`);
  return {
    success: true,
    jobs_created: totalJobsCreated,
    run_ids: runIds,
  };
}

/**
 * Main entry: schedule by source ("demo" | "db" | "user").
 * @param {object} supabase - Supabase client
 * @param {{ source: 'demo' | 'db' | 'user', run_type?: string, demo_contract?: object, user_id?: string }} payload
 * @param {string} [userId] - optional for demo/user (e.g. from auth)
 * @param {string[]} [logs] - optional array to push log lines
 */
export async function schedule(supabase, payload, userId = null, logs = null) {
  const source = payload?.source;
  if (source !== "demo" && source !== "db" && source !== "user") {
    return { success: false, error: "INVALID_SOURCE", message: "Source must be 'demo', 'db', or 'user'." };
  }
  if (source === "demo") {
    const contract = payload?.demo_contract;
    if (!contract || typeof contract !== "object") {
      return { success: false, error: "DEMO_JSON_PARSE_ERROR", message: "demo_contract is required for source demo." };
    }
    return scheduleFromDemo(supabase, contract, payload?.run_type || "manual", userId, logs);
  }
  if (source === "user") {
    const uid = userId ?? payload?.user_id;
    if (!uid) {
      return { success: false, error: "USER_REQUIRED", message: "userId or payload.user_id is required for source user." };
    }
    return scheduleForUser(supabase, uid, logs);
  }
  return scheduleFromDb(supabase, logs);
}
