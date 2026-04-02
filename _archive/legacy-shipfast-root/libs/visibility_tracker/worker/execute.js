/**
 * Visibility Tracker - Execute step: run assigned_jobs through SERP/AI providers, return job_reports only (no DB write).
 */

import { fetchSerp } from "@/libs/visibility_tracker/providers/serpProvider";
import {
  runPrompt,
  extractMentions,
  extractCitations,
  hashResponse,
} from "@/libs/visibility_tracker/providers/aiProvider";
import { buildJobReport } from "@/libs/visibility_tracker/schemas";

/**
 * Execute assigned jobs and return job_reports.
 * @param {Array<{ job_id: string, job_type: string, metadata: object }>} assignedJobs - From Assign step
 * @param {string[]} [logs] - optional array to push log lines
 * @returns {Promise<Array<{ job_id: string, ok: boolean, duration_ms: number, payload: object, error?: string }>>}
 */
export async function executeJobs(assignedJobs, logs = null) {
  const L = (msg) => {
    if (Array.isArray(logs)) logs.push(msg);
  };
  const job_reports = [];

  for (const job of assignedJobs || []) {
    const start = Date.now();
    try {
      if (job.job_type === "serp_keyword") {
        const meta = job.metadata || {};
        const serpResult = await fetchSerp({
          keyword: meta.keyword,
          domain: meta.domain,
          location: meta.location || "US",
          device: meta.device || "desktop",
        });
        const payload = {
          rank: serpResult.rank,
          best_url: serpResult.bestUrl,
          serp_features: serpResult.features,
          raw: serpResult.raw,
          engine: meta.engine || "google",
          location: meta.location || "US",
          device: meta.device || "desktop",
        };
        const duration_ms = Date.now() - start;
        L(`Executing job_id=${job.job_id}, type=serp_keyword → ok=true, duration_ms=${duration_ms}`);
        job_reports.push(buildJobReport(job.job_id, true, duration_ms, payload));
      } else if (job.job_type === "ai_prompt") {
        const meta = job.metadata || {};
        const model = meta.model || "chatgpt";
        const aiResult = await runPrompt({
          model,
          promptText: meta.prompt_text,
        });
        const brandTerms = meta.brand_terms ?? [];
        const domain = meta.domain ?? "";
        const { mentionsBrand, mentionsDomain } = extractMentions({
          responseText: aiResult.text,
          brandTerms,
          domain,
        });
        const citationData = extractCitations({
          responseText: aiResult.text,
          rawJson: aiResult.rawJson,
          domain,
        });
        const payload = {
          model,
          response_text: aiResult.text,
          response_json: aiResult.rawJson,
          mentions_brand: mentionsBrand,
          mentions_domain: mentionsDomain,
          citations: citationData.domainCitations,
          response_hash: hashResponse(aiResult.text),
        };
        const duration_ms = Date.now() - start;
        L(`Executing job_id=${job.job_id}, type=ai_prompt → ok=true, duration_ms=${duration_ms}`);
        job_reports.push(buildJobReport(job.job_id, true, duration_ms, payload));
      } else {
        const duration_ms = Date.now() - start;
        L(`Executing job_id=${job.job_id}, type=${job.job_type} → ok=false, duration_ms=${duration_ms} (unknown job_type)`);
        job_reports.push(
          buildJobReport(job.job_id, false, duration_ms, {}, `Unknown job_type: ${job.job_type}`)
        );
      }
    } catch (err) {
      const duration_ms = Date.now() - start;
      L(`Executing job_id=${job.job_id}, type=${job.job_type} → ok=false, duration_ms=${duration_ms} (${err?.message || err})`);
      job_reports.push(
        buildJobReport(job.job_id, false, duration_ms, {}, err?.message || String(err))
      );
    }
  }

  return job_reports;
}
