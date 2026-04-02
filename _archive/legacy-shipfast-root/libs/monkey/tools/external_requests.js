/**
 * External requests: finish tracking (best-effort, no route-breaking).
 * Update external_requests status after provider call completes.
 */

const PREVIEW_MAX = 500;

function truncate(str, maxLen) {
  if (str == null || typeof str !== "string") return null;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

/**
 * UUID v4 regex for validation.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Finish external request: update status, response_preview/error_message, finished_at, latency_ms.
 * Best-effort: if externalRequestId is missing/invalid, skip update; do not throw.
 *
 * @param {object} supabase - Supabase client
 * @param {{ externalRequestId?: string|null, status: 'success'|'failed', responsePreview?: string|null, errorMessage?: string|null, latencyMs?: number|null }} opts
 */
export async function finishExternalRequest(supabase, { externalRequestId, status, responsePreview, errorMessage, latencyMs }) {
  if (!externalRequestId || typeof externalRequestId !== "string") return;
  const trimmed = externalRequestId.trim();
  if (!trimmed || !UUID_REGEX.test(trimmed)) return;
  if (status !== "success" && status !== "failed") return;

  try {
    const payload = {
      status,
      finished_at: new Date().toISOString(),
      latency_ms: typeof latencyMs === "number" ? latencyMs : null,
    };
    if (status === "success" && responsePreview != null) {
      payload.response_preview = truncate(String(responsePreview), PREVIEW_MAX);
    }
    if (status === "failed" && errorMessage != null) {
      payload.error_message = truncate(String(errorMessage), PREVIEW_MAX);
    }

    await supabase.from("external_requests").update(payload).eq("id", trimmed);
  } catch {
    // Best-effort: never throw
  }
}
