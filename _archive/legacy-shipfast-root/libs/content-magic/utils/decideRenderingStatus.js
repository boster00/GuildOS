/**
 * Classifies a raw v0 chat response as Rendering / Failed / Completed.
 * Single source of truth for Edit Draft status; used by outline-status API.
 */

const STOP_SIGNAL_THRESHOLD_MS = 20 * 60 * 1000; // 20 min: stop signals after this age are definitive
const HARD_STALE_THRESHOLD_MS = 45 * 60 * 1000;  // 45 min: age alone is enough to call Failed

const TERMINAL_STATUSES = ['failed', 'canceled', 'cancelled', 'errored', 'error'];

/** Normalize ISO string or ms number to ms. Export for use in outline-status route. */
export function toMs(ts) {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return new Date(ts).getTime();
  return NaN;
}

/**
 * Iteratively collect all task-stopped-* parts from a message's experimental_content.
 * Depth-capped to avoid pathological recursion.
 * @param {Object} msg - message with experimental_content
 * @param {number} maxDepth
 * @returns {Array<{ createdAt: number, type: string }>}
 */
function findTaskStoppedParts(msg, maxDepth = 10) {
  const results = [];
  const stack = [{ node: msg.experimental_content || [], depth: 0 }];
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (depth > maxDepth || node == null) continue;
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, depth: depth + 1 });
    } else if (typeof node === 'object') {
      const part = node.part ?? node;
      if (typeof part?.type === 'string' && part.type.startsWith('task-stopped')) {
        const ts = Number(part.createdAt);
        if (!isNaN(ts)) results.push({ createdAt: ts, type: part.type });
      }
      for (const val of Object.values(node)) stack.push({ node: val, depth: depth + 1 });
    }
  }
  return results;
}

/**
 * Decide rendering status from raw v0 chat object.
 * @param {Object} raw - the `raw` object from v0GetChatRaw (raw.latestVersion, raw.messages)
 * @param {{ attemptStartedAtMs?: number, initiatedAtMs?: number }} [opts] - attemptStartedAtMs: stop-detection boundary; initiatedAtMs: when this run started (for no-version timeout)
 * @returns {{ status: 'Rendering'|'Failed'|'Completed', reason: string, reasoningLog?: string[] }}
 */
export function decideRenderingStatus(raw, { attemptStartedAtMs, initiatedAtMs } = {}) {
  const log = [];
  log.push(`Input: latestVersion present=${!!raw?.latestVersion}, initiatedAtMs=${initiatedAtMs ?? 'undefined'}, attemptStartedAtMs=${attemptStartedAtMs ?? 'undefined'}`);

  const version = raw?.latestVersion;
  if (!version) {
    log.push('No latestVersion on raw; checking age vs HARD_STALE_THRESHOLD_MS');
    const nowMs = Date.now();
    const initiated = initiatedAtMs != null && !isNaN(initiatedAtMs) ? initiatedAtMs : nowMs;
    const ageMs = nowMs - initiated;
    log.push(`ageMs=${ageMs}, HARD_STALE_THRESHOLD_MS=${HARD_STALE_THRESHOLD_MS}`);
    if (ageMs >= HARD_STALE_THRESHOLD_MS) {
      log.push(`ageMs >= HARD_STALE_THRESHOLD_MS → FAIL (no latestVersion, stale)`);
      return { status: 'Failed', reason: 'no latestVersion (stale)', reasoningLog: log };
    }
    log.push('Within threshold → RENDERING (no latestVersion yet)');
    return { status: 'Rendering', reason: 'no latestVersion', reasoningLog: log };
  }

  const status = version.status;
  const files = version.files || [];
  const hasIndexHtml = files.some((f) => (f?.name ?? '').toString().includes('index.html'));
  const indexHtmlFile = files.find((f) => (f?.name ?? '').toString().includes('index.html'));
  const indexHtmlContent = indexHtmlFile?.source ?? indexHtmlFile?.content ?? indexHtmlFile?.code ?? '';
  const indexHtmlBytes = typeof indexHtmlContent === 'string' ? indexHtmlContent.length : 0;

  log.push(`latestVersion.status=${status}, hasIndexHtml=${hasIndexHtml}, indexHtmlBytes=${indexHtmlBytes}`);

  // —— Rule 1: Completed ——
  if (status === 'completed') {
    if (!hasIndexHtml) {
      log.push('status=completed but no index.html in files → FAIL');
      return { status: 'Failed', reason: 'Generation failed', reasoningLog: log };
    }
    if (indexHtmlBytes === 0) {
      log.push('status=completed, index.html present but empty → FAIL');
      return { status: 'Failed', reason: 'completed but index.html empty', reasoningLog: log };
    }
    // If the latest user message (by time) is after latestVersion.updatedAt, feedback was sent and v0 hasn't produced a new version yet
    const versionUpdatedMs = toMs(version.updatedAt);
    const messages = raw.messages || [];
    let lastUserMsgTimeMs = null;
    for (const msg of messages) {
      if (msg?.role !== 'user') continue;
      const ts = toMs(msg.createdAt ?? msg.updatedAt);
      if (!isNaN(ts) && (lastUserMsgTimeMs == null || ts > lastUserMsgTimeMs)) {
        lastUserMsgTimeMs = ts;
      }
    }
    if (!isNaN(versionUpdatedMs) && lastUserMsgTimeMs != null && lastUserMsgTimeMs > versionUpdatedMs) {
      log.push(`latestVersion.updatedAt=${versionUpdatedMs}, last user message at ${lastUserMsgTimeMs} (after version) → awaiting new generation → RENDERING`);
      return { status: 'Rendering', reason: 'completed but latest user message is after version.updatedAt', reasoningLog: log };
    }
    if (lastUserMsgTimeMs != null) {
      log.push(`latestVersion.updatedAt=${versionUpdatedMs}, last user message at ${lastUserMsgTimeMs} (not after version) → COMPLETED`);
    }
    log.push('status=completed and index.html has content → COMPLETED');
    return { status: 'Completed', reason: 'status=completed and index.html found', reasoningLog: log };
  }

  // Known terminal failure statuses from v0
  if (TERMINAL_STATUSES.includes(String(status).toLowerCase())) {
    log.push(`v0 status "${status}" is in TERMINAL_STATUSES → FAIL`);
    return { status: 'Failed', reason: `v0 status=${status}`, reasoningLog: log };
  }

  // —— Rule 2: Rendering (pending + within 45m + no stop after boundary) ——
  if (status !== 'pending') {
    log.push(`status "${status}" is not "pending" and not completed/terminal → FAIL (unexpected)`);
    return { status: 'Failed', reason: `unexpected status=${status}`, reasoningLog: log };
  }

  const versionCreatedMs = toMs(version.createdAt);
  const boundaryMs = attemptStartedAtMs != null && !isNaN(attemptStartedAtMs) ? attemptStartedAtMs : versionCreatedMs;
  log.push(`version.createdAt→${versionCreatedMs}, boundaryMs=${boundaryMs} (from ${attemptStartedAtMs != null && !isNaN(attemptStartedAtMs) ? 'opts.attemptStartedAtMs' : 'version.createdAt'})`);

  if (isNaN(boundaryMs)) {
    log.push('boundaryMs is NaN → FAIL (invalid version timestamp)');
    return { status: 'Failed', reason: 'invalid version timestamp', reasoningLog: log };
  }

  const nowMs = Date.now();
  const ageMs = nowMs - versionCreatedMs;
  log.push(`ageMs=${ageMs}, HARD_STALE_THRESHOLD_MS=${HARD_STALE_THRESHOLD_MS}`);

  // 2b: age alone beyond 45m → Failed
  if (ageMs >= HARD_STALE_THRESHOLD_MS) {
    log.push(`ageMs >= HARD_STALE_THRESHOLD_MS → FAIL (stale > 45m)`);
    return { status: 'Failed', reason: 'stale > 45m', reasoningLog: log };
  }

  // 2c: any task-stopped-* part with createdAt > boundaryMs
  let maxStoppedPartCreatedAt = null;
  let messagesScanned = 0;
  let stopPartsFound = 0;
  const messages = raw.messages || [];
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    messagesScanned += 1;
    const str = JSON.stringify(msg.experimental_content || []);
    if (!str.includes('task-stopped')) continue;
    const parts = findTaskStoppedParts(msg);
    for (const part of parts) {
      stopPartsFound += 1;
      if (part.createdAt > boundaryMs) {
        if (maxStoppedPartCreatedAt == null || part.createdAt > maxStoppedPartCreatedAt) {
          maxStoppedPartCreatedAt = part.createdAt;
        }
      }
    }
  }
  log.push(`task-stopped scan: ${messagesScanned} assistant messages with "task-stopped", ${stopPartsFound} stop parts total; maxStoppedPartCreatedAt after boundary=${maxStoppedPartCreatedAt ?? 'none'}`);

  if (maxStoppedPartCreatedAt != null) {
    const suspectStale = ageMs > STOP_SIGNAL_THRESHOLD_MS;
    log.push(`Stop signal after boundary. ageMs=${ageMs}, STOP_SIGNAL_THRESHOLD_MS=${STOP_SIGNAL_THRESHOLD_MS}, suspectStale=${suspectStale}`);
    if (suspectStale) {
      log.push(`ageMs > STOP_SIGNAL_THRESHOLD_MS + stop signal → FAIL`);
      return { status: 'Failed', reason: `stale (${ageMs}ms) + stop signal`, reasoningLog: log };
    }
    log.push('task-stopped after boundary (within 20m) → FAIL');
    return { status: 'Failed', reason: 'task-stopped after boundary', reasoningLog: log };
  }

  log.push('pending, within 45m, no stop signal after boundary → RENDERING');
  return { status: 'Rendering', reason: 'pending, within 45m, no stop signal', reasoningLog: log };
}
