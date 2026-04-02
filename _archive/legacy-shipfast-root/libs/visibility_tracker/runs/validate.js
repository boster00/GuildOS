/**
 * Visibility Tracker - Validate Run step: aggregate run stats, set run status, return summary.
 */

/**
 * Validate a run: count jobs and results, set run status, return summary.
 * @param {object} supabase - Service role client
 * @param {{ run_id: string }} params
 * @returns {Promise<{ run_id: string, status: string, summary: { jobs_expected: number, results_persisted: number, jobs_failed: number } }>}
 */
export async function validateRun(supabase, params) {
  const { run_id, logs = null } = params;
  const L = (msg) => {};

  if (!run_id) throw new Error("RUN_ID_INVALID");

  const { data: run, error: runErr } = await supabase
    .from("vt_runs")
    .select("id")
    .eq("id", run_id)
    .single();

  if (runErr || !run) throw new Error("RUN_NOT_FOUND");

  const { count: jobs_expected } = await supabase
    .from("vt_jobs")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run_id);

  const { count: serpCount } = await supabase
    .from("vt_serp_results")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run_id);

  const { count: aiCount } = await supabase
    .from("vt_ai_results")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run_id);

  const results_persisted = (serpCount ?? 0) + (aiCount ?? 0);

  const { count: jobs_failed } = await supabase
    .from("vt_jobs")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run_id)
    .eq("status", "failed");

  const totalJobs = jobs_expected ?? 0;
  const failed = jobs_failed ?? 0;
  const persisted = results_persisted;
  let status = "success";
  if (failed === totalJobs && totalJobs > 0) status = "failed";
  else if (failed > 0) status = "partial";

  L(`jobs_expected: ${totalJobs}, results_persisted: ${persisted}, jobs_failed: ${failed}`);
  L(`Run status set to: ${status}`);

  await supabase
    .from("vt_runs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("id", run_id);

  return {
    run_id,
    status,
    summary: {
      jobs_expected: totalJobs,
      results_persisted,
      jobs_failed: failed,
    },
  };
}

