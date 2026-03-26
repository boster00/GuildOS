/**
 * Visibility Tracker - Assign step: claim queued jobs for a worker, return assigned_jobs (spec shape).
 * When run_id is provided, claims only jobs for that run (select + update). Otherwise uses RPC claim_vt_jobs.
 */

/**
 * Claim jobs for worker. When run_id is set, claim only from that run; otherwise use RPC.
 * @param {object} supabase - Service role client
 * @param {{ run_id?: string, worker_id: string, batch_size: number, logs?: string[] }} params
 * @returns {Promise<{ assigned_jobs: Array<{ job_id: string, job_type: string, metadata: object }>, raw_jobs: object[] }>}
 */
export async function assignJobs(supabase, params) {
  const { run_id, worker_id, batch_size = 5, logs = null } = params;
  const L = (msg) => {
    if (Array.isArray(logs)) logs.push(msg);
  };
  if (!worker_id) {
    throw new Error("WORKER_ID_REQUIRED");
  }

  L(`Claiming jobs (run_id scoped: ${run_id || "global"})`);
  let rawJobs = [];

  if (run_id) {
    const { data: queued, error: selectErr } = await supabase
      .from("vt_jobs")
      .select("*")
      .eq("run_id", run_id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(Math.min(batch_size, 100));

    if (selectErr) throw selectErr;
    if (!queued?.length) {
      L("Claimed 0 jobs");
      return { assigned_jobs: [], raw_jobs: [] };
    }

    const now = new Date().toISOString();
    for (const j of queued) {
      const { error: updateErr } = await supabase
        .from("vt_jobs")
        .update({ status: "assigned", worker_id, locked_at: now })
        .eq("id", j.id);
      if (!updateErr) rawJobs.push({ ...j, status: "assigned", worker_id, locked_at: now });
    }
  } else {
    const { data: claimed, error: claimErr } = await supabase.rpc("claim_vt_jobs", {
      p_worker_id: worker_id,
      p_batch_size: Math.min(batch_size, 100),
    });
    if (claimErr) throw claimErr;
    rawJobs = Array.isArray(claimed) ? claimed : [];
  }

  L(`Claimed ${rawJobs.length} jobs`);
  for (const j of rawJobs) L(`Assigned job_id=${j.id}, job_type=${j.job_type}`);
  const assigned_jobs = await enrichToAssignedJobs(supabase, rawJobs);
  return { assigned_jobs, raw_jobs: rawJobs };
}

/**
 * Enrich raw job rows to spec shape: { job_id, job_type, metadata }.
 * Includes domain (and brand_terms for AI) so Execute step can run without DB reads.
 */
async function enrichToAssignedJobs(supabase, rawJobs) {
  const out = [];
  for (const job of rawJobs) {
    const base = { job_id: job.id, job_type: job.job_type, metadata: { ...(job.metadata || {}) } };
    if (job.job_type === "serp_keyword") {
      const { data: kw } = await supabase
        .from("vt_keywords")
        .select("keyword, vt_projects(domain)")
        .eq("id", job.entity_id)
        .single();
      base.metadata.keyword = kw?.keyword ?? "";
      base.metadata.domain = kw?.vt_projects?.domain ?? "";
    } else if (job.job_type === "ai_prompt") {
      const { data: prompt } = await supabase
        .from("vt_prompts")
        .select("prompt_text, vt_projects(domain, brand_terms)")
        .eq("id", job.entity_id)
        .single();
      base.metadata.prompt_text = prompt?.prompt_text ?? "";
      if (!base.metadata.model) base.metadata.model = "chatgpt";
      base.metadata.domain = prompt?.vt_projects?.domain ?? "";
      base.metadata.brand_terms = prompt?.vt_projects?.brand_terms ?? [];
    }
    out.push(base);
  }
  return out;
}
