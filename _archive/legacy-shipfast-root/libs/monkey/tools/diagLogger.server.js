/**
 * Server-only diagnostic logger. Do not import on client.
 * Implementation for monkey.diag; loaded lazily by Monkey on first use.
 */

if (typeof window !== "undefined") {
  throw new Error("diagLogger.server.js must not be imported on client");
}

async function getSupabase() {
  const { createServiceRoleClient } = await import("@/libs/supabase/serviceRole.js");
  return createServiceRoleClient();
}

const DEPLOY_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
const RING_CAP = 500;
const META_CAP = 16_000;
const RETENTION_CAP = 10_000;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "password",
  "secret",
  "stripe_signature",
  "set-cookie",
  "x-api-key",
]);

function sanitize(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = String(k).toLowerCase();
    if (SENSITIVE_KEYS.has(lower)) continue;
    out[k] = sanitize(v);
  }
  return out;
}

function capMeta(meta) {
  if (meta === null || typeof meta !== "object") return meta;
  try {
    const s = JSON.stringify(meta);
    if (s.length > META_CAP) return { truncated: true };
  } catch (_) {
    return { truncated: true };
  }
  return meta;
}

/**
 * Factory: returns a per-instance diag object (own ring buffer).
 * @param {object} _monkeyInstance - Monkey instance (for future use; buffer is per diag instance)
 * @returns {object} diag API
 */
function createDiag(_monkeyInstance) {
  const buffer = [];

  function enabled() {
    const v = process.env.PRODUCTION_LOG_TOGGLE;
    return ["1", "true", "yes"].includes(String(v || "").toLowerCase());
  }

  function genRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function log(level, message, meta = {}, opts = {}) {
    if (!enabled()) return;
    const event = {
      ts: new Date().toISOString(),
      level: String(level),
      message: String(message),
      meta: sanitize(meta),
      request_id: opts.request_id ?? null,
      source: opts.source ?? "server",
      deploy_id: DEPLOY_ID,
    };
    buffer.push(event);
    if (buffer.length > RING_CAP) buffer.shift();
  }

  async function flush(flushOpts = {}) {
    if (!enabled()) return;
    const events = buffer.splice(0, buffer.length);
    if (events.length === 0) {
      maybeCleanup();
      return;
    }
    try {
      const supabase = await getSupabase();
      const rows = events.map((e) => ({
        ts: e.ts,
        deploy_id: e.deploy_id,
        source: e.source,
        level: e.level,
        request_id: e.request_id,
        message: e.message,
        meta: capMeta(e.meta),
      }));
      const { error } = await supabase.from("diag_log_events").insert(rows);
      if (error) throw error;
    } catch (e) {
    }
    await maybeCleanup();
  }

  async function maybeCleanup() {
    if (Math.random() >= 0.01) return;
    try {
      await cleanup();
    } catch (e) {
    }
  }

  async function cleanup() {
    if (!enabled()) return;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.rpc("diag_log_events_cleanup");
      if (error) throw error;
    } catch (e) {
      throw e;
    }
  }

  async function queryLogs(opts = {}) {
    const { q, level, source, request_id, since, limit = 200 } = opts;
    const supabase = await getSupabase();
    let query = supabase
      .from("diag_log_events")
      .select("*")
      .order("ts", { ascending: false })
      .limit(Math.min(Number(limit) || 200, 500));

    if (q && String(q).trim()) {
      query = query.ilike("message", `%${String(q).trim()}%`);
    }
    if (level && String(level).trim()) {
      query = query.eq("level", String(level).trim().toLowerCase());
    } else {
      query = query.neq("level", "debug");
    }
    if (source && String(source).trim()) {
      query = query.eq("source", String(source).trim());
    }
    if (request_id && String(request_id).trim()) {
      query = query.eq("request_id", String(request_id).trim());
    }
    if (since && String(since).trim()) {
      const now = new Date();
      const m = String(since).toLowerCase();
      let from;
      if (m === "1h") from = new Date(now - 60 * 60 * 1000);
      else if (m === "6h") from = new Date(now - 6 * 60 * 60 * 1000);
      else if (m === "24h") from = new Date(now - 24 * 60 * 60 * 1000);
      else if (m === "7d") from = new Date(now - 7 * 24 * 60 * 60 * 1000);
      else from = new Date(now - 24 * 60 * 60 * 1000);
      query = query.gte("ts", from.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return { rows: data ?? [] };
  }

  return {
    enabled,
    log,
    flush,
    cleanup,
    sanitize,
    genRequestId,
    queryLogs,
  };
}

module.exports = { createDiag };
