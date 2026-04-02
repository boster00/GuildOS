/**
 * Visibility Tracker - canonical schemas for the 6-step cron pipeline.
 * JobReport: output of Execute step; input to Log Results step.
 * JobTypeRegistry: job_type → metadata shape, retry defaults, result table routing.
 */

/** Canonical JobReport shape (Execute step output) */
export const JOB_REPORT_SHAPE = {
  job_id: "uuid",
  ok: "boolean",
  duration_ms: "number",
  payload: "object",
  error: "string | undefined",
};

/**
 * Build a JobReport object (for Execute → Log Results).
 * @param {string} job_id - vt_jobs.id
 * @param {boolean} ok - success/failure
 * @param {number} duration_ms - execution time
 * @param {object} payload - type-specific result (e.g. rank, best_url for SERP; response_text, model for AI)
 * @param {string} [error] - error message when ok is false
 * @returns {{ job_id, ok, duration_ms, payload, error? }}
 */
export function buildJobReport(job_id, ok, duration_ms, payload, error = undefined) {
  const report = { job_id, ok, duration_ms, payload: payload || {} };
  if (error != null) report.error = String(error);
  return report;
}

/**
 * Validate a JobReport has required fields.
 * @param {unknown} report
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateJobReport(report) {
  if (!report || typeof report !== "object") {
    return { valid: false, error: "JOB_REPORT_INVALID: must be an object" };
  }
  if (!report.job_id) {
    return { valid: false, error: "JOB_REPORT_INVALID: missing job_id" };
  }
  if (typeof report.ok !== "boolean") {
    return { valid: false, error: "JOB_REPORT_INVALID: missing or invalid ok" };
  }
  if (typeof report.duration_ms !== "number") {
    return { valid: false, error: "JOB_REPORT_INVALID: missing or invalid duration_ms" };
  }
  if (report.payload != null && typeof report.payload !== "object") {
    return { valid: false, error: "JOB_REPORT_INVALID: payload must be object" };
  }
  return { valid: true };
}

/** Job type registry: job_type → { resultTable, metadataShape, maxRetries } */
export const JOB_TYPE_REGISTRY = {
  serp_keyword: {
    resultTable: "vt_serp_results",
    maxRetries: 3,
    metadataShape: ["keyword", "engine", "location", "device"],
  },
  ai_prompt: {
    resultTable: "vt_ai_results",
    maxRetries: 3,
    metadataShape: ["prompt_text", "model"],
  },
};

/**
 * Get registry entry for a job type.
 * @param {string} jobType
 * @returns {{ resultTable: string, maxRetries: number } | null}
 */
export function getJobTypeConfig(jobType) {
  return JOB_TYPE_REGISTRY[jobType] || null;
}
