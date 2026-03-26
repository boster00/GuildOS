/**
 * Visibility Tracker - Archive step: delete completed vt_jobs, update vt_runs when run has no jobs left.
 * When run_id is provided, scope to that run; otherwise archive all completed jobs.
 * Returns: deleted_jobs (count), remaining_jobs (count for run or globally).
 */

/**
 * Archive completed jobs, optionally scoped to a run.
 * @param {object} supabase - Service role client
 * @param {{ run_id?: string, logs?: string[] }} params
 * @returns {Promise<{ deleted_jobs: number, remaining_jobs: number }>}
 */
export async function archiveJobs(supabase, params = {}) {
  const { run_id, logs = null } = params;
  const L = (msg) => {};

  let query = supabase.from("vt_jobs").select("id, run_id").eq("status", "completed");
  if (run_id) {
    query = query.eq("run_id", run_id);
  }
  const { data: completedJobs, error: getError } = await query;

  if (getError) throw getError;
  const toDelete = completedJobs ?? [];
  if (toDelete.length === 0) {
    L(`Deleted 0 completed jobs, remaining: (counted below)`);
    let remaining = 0;
    if (run_id) {
      const { count } = await supabase.from("vt_jobs").select("id", { count: "exact", head: true }).eq("run_id", run_id);
      remaining = count ?? 0;
    } else {
      const { count } = await supabase.from("vt_jobs").select("id", { count: "exact", head: true });
      remaining = count ?? 0;
    }
    return { deleted_jobs: 0, remaining_jobs: remaining };
  }

  let deleteQuery = supabase.from("vt_jobs").delete().eq("status", "completed");
  if (run_id) deleteQuery = deleteQuery.eq("run_id", run_id);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const runIds = [...new Set(toDelete.map((j) => j.run_id))];
  const now = new Date().toISOString();
  for (const runId of runIds) {
    const { data: remaining } = await supabase.from("vt_jobs").select("id").eq("run_id", runId).limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from("vt_runs").update({ status: "success", finished_at: now }).eq("id", runId);
    }
  }

  let remaining_jobs = 0;
  if (run_id) {
    const { count } = await supabase.from("vt_jobs").select("id", { count: "exact", head: true }).eq("run_id", run_id);
    remaining_jobs = count ?? 0;
  } else {
    const { count } = await supabase.from("vt_jobs").select("id", { count: "exact", head: true });
    remaining_jobs = count ?? 0;
  }

  L(`Deleted ${toDelete.length} completed jobs, remaining: ${remaining_jobs}`);
  return { deleted_jobs: toDelete.length, remaining_jobs };
}
