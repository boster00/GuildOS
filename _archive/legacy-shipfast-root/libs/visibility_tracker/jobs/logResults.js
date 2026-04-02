/**
 * Visibility Tracker - Log Results step: persist job_reports to vt_serp_results / vt_ai_results and update vt_jobs.
 * Input: run_id, job_reports[] (from Execute step).
 * Output: persisted[] (result_table, result_id), job_updates[] (job_id, status).
 */

import { getJobTypeConfig } from "../schemas";

/**
 * Persist job reports and update job statuses.
 * @param {object} supabase - Service role client
 * @param {{ run_id: string, job_reports: Array, logs?: string[] }} params
 * @returns {Promise<{ persisted: Array<{ result_table: string, result_id: string }>, job_updates: Array<{ job_id: string, status: string }> }>}
 */
export async function logResults(supabase, params) {
  const { run_id, job_reports, logs = null } = params;
  const L = (msg) => {};

  if (!run_id || !Array.isArray(job_reports)) {
    throw new Error("RUN_ID_AND_REPORTS_REQUIRED");
  }

  const persisted = [];
  const job_updates = [];
  const now = new Date().toISOString();

  for (const report of job_reports) {
    const { data: job, error: jobErr } = await supabase
      .from("vt_jobs")
      .select("id, run_id, entity_id, job_type, metadata")
      .eq("id", report.job_id)
      .eq("run_id", run_id)
      .single();

    if (jobErr || !job) {
      L(`Persisting job_id=${report.job_id} → failed (job not found for run)`);
      job_updates.push({ job_id: report.job_id, status: "failed" });
      continue;
    }

    const config = getJobTypeConfig(job.job_type);
    const status = report.ok ? "completed" : "failed";

    if (report.ok && config) {
      if (job.job_type === "serp_keyword") {
        const p = report.payload || {};
        const engine = p.engine ?? job.metadata?.engine ?? "google";
        const location = p.location ?? job.metadata?.location ?? "US";
        const device = p.device ?? job.metadata?.device ?? "desktop";
        // Dedupe: skip if (run_id, keyword_id, engine, location, device) already exists
        const { data: existing } = await supabase
          .from("vt_serp_results")
          .select("id")
          .eq("run_id", job.run_id)
          .eq("keyword_id", job.entity_id)
          .eq("engine", engine)
          .eq("location", location)
          .eq("device", device)
          .limit(1);
        if (existing?.[0]?.id) {
          L(`Persisting job_id=${report.job_id}, job_type=serp_keyword → skip (duplicate result)`);
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("vt_serp_results")
            .insert({
              run_id: job.run_id,
              keyword_id: job.entity_id,
              engine,
              location,
              device,
              rank: p.rank ?? null,
              best_url: p.best_url ?? p.bestUrl ?? null,
              serp_features: p.serp_features ?? p.features ?? {},
              raw: p.raw ?? null,
            })
            .select("id")
            .single();
          if (!insErr && inserted) {
            persisted.push({ result_table: "vt_serp_results", result_id: inserted.id });
            L(`Persisting job_id=${report.job_id}, job_type=serp_keyword → persisted to vt_serp_results (ok)`);
          } else {
            L(`Persisting job_id=${report.job_id}, job_type=serp_keyword → failed (insert error)`);
          }
        }
      } else if (job.job_type === "ai_prompt") {
        const p = report.payload || {};
        const model = p.model ?? job.metadata?.model ?? "chatgpt";
        // Dedupe: skip if (run_id, prompt_id, model) already exists
        const { data: existingAi } = await supabase
          .from("vt_ai_results")
          .select("id")
          .eq("run_id", job.run_id)
          .eq("prompt_id", job.entity_id)
          .eq("model", model)
          .limit(1);
        if (existingAi?.[0]?.id) {
          L(`Persisting job_id=${report.job_id}, job_type=ai_prompt → skip (duplicate result)`);
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("vt_ai_results")
            .insert({
              run_id: job.run_id,
              prompt_id: job.entity_id,
              model,
              response_text: p.response_text ?? p.text ?? "",
              response_json: p.response_json ?? p.rawJson ?? null,
              mentions_brand: p.mentions_brand ?? p.mentionsBrand ?? false,
              mentions_domain: p.mentions_domain ?? p.mentionsDomain ?? false,
              citations: p.citations ?? [],
              response_hash: p.response_hash ?? null,
            })
            .select("id")
            .single();
          if (!insErr && inserted) {
            persisted.push({ result_table: "vt_ai_results", result_id: inserted.id });
            L(`Persisting job_id=${report.job_id}, job_type=ai_prompt → persisted to vt_ai_results (ok)`);
          } else {
            L(`Persisting job_id=${report.job_id}, job_type=ai_prompt → failed (insert error)`);
          }
        }
      }
    } else {
      L(`Persisting job_id=${report.job_id}, job_type=${job.job_type} → job update only (report.ok=false or unknown type)`);
    }

    await supabase
      .from("vt_jobs")
      .update({
        status,
        done_at: now,
        ...(report.error ? { error: report.error } : {}),
      })
      .eq("id", report.job_id);

    job_updates.push({ job_id: report.job_id, status });
  }

  L(`Total persisted: ${persisted.length}, job_updates: ${job_updates.length}`);
  return { persisted, job_updates };
}
