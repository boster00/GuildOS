/**
 * Cursor weapon — Cursor Cloud Agent dispatch and management via Cursor API.
 *
 * Auth: CURSOR_API_KEY from profiles.env_vars or process.env.
 * Endpoint: https://api.cursor.com/v0/agents
 * Model: composer-2.0 (cheapest in-house model)
 */

export const toc = {
  readAgent: "Read a Cursor cloud agent's status and metadata.",
  readConversation: "Read a Cursor agent's full conversation history.",
  writeFollowup: "Send a followup message to a Cursor agent (push-based dispatch).",
  searchAgents: "Search Cursor agents (wraps readAgent; API has no list endpoint).",
  readQueuedMessages: "Read queued user messages sent after the last assistant reply.",
  writeAgent: "Create a new Cursor cloud agent for a given repository.",
  readEnvSetupInstructions: "Generate an env setup script to bootstrap a fresh Cursor agent session.",
  syncSessionStatus: "Probe an adventurer's upstream Cursor session status and reconcile the adventurers DB row. Returns { upstream_status, alive, dispatch_safe, was_drift }.",
};
import { database } from "@/libs/council/database";

const API_BASE = "https://api.cursor.com/v0/agents";
const DEFAULT_MODEL = "composer-2.0";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getApiKey(userId) {
  if (process.env.CURSOR_API_KEY) return process.env.CURSOR_API_KEY;
  if (!userId) return null;
  const db = await database.init("service");
  const { data } = await db
    .from("profiles")
    .select("env_vars")
    .eq("id", userId)
    .single();
  return data?.env_vars?.CURSOR_API_KEY ?? null;
}

function makeAuthHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function cursorFetch(path, opts = {}, userId) {
  const key = await getApiKey(userId);
  if (!key) throw new Error("Missing CURSOR_API_KEY");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: makeAuthHeader(key),
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cursor API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Agent management
// ---------------------------------------------------------------------------

/**
 * Read agent status.
 * @param {{ agentId: string }} input
 * @param {string} [userId]
 */
export async function readAgent({ agentId } = {}, userId) {
  if (!agentId) throw new Error("agentId is required");
  return cursorFetch(`/${agentId}`, {}, userId);
}

/**
 * Read agent conversation history.
 * @param {{ agentId: string }} input
 * @param {string} [userId]
 */
export async function readConversation({ agentId } = {}, userId) {
  if (!agentId) throw new Error("agentId is required");
  return cursorFetch(`/${agentId}/conversation`, {}, userId);
}

/**
 * Send a followup message to an agent (push-based dispatch).
 * @param {{ agentId: string, message: string, model?: string }} input
 * @param {string} [userId]
 */
export async function writeFollowup({ agentId, message, model } = {}, userId) {
  if (!agentId) throw new Error("agentId is required");
  if (!message) throw new Error("message is required");
  return cursorFetch(
    `/${agentId}/followup`,
    {
      method: "POST",
      body: JSON.stringify({
        prompt: { text: message },
      }),
    },
    userId,
  );
}

/**
 * Search for agents by partial ID or metadata.
 * Note: Cursor API doesn't have a list endpoint — this reads a known agent.
 * For now, wraps readAgent. Extend when API adds list support.
 * @param {{ agentId: string }} input
 * @param {string} [userId]
 */
export async function searchAgents({ agentId } = {}, userId) {
  if (!agentId) throw new Error("agentId is required for search (Cursor API has no list endpoint)");
  const agent = await readAgent({ agentId }, userId);
  return { agents: [agent] };
}

/**
 * Read queued (unprocessed) messages — user messages sent after the last assistant response.
 * @param {{ agentId: string }} input
 * @param {string} [userId]
 */
export async function readQueuedMessages({ agentId } = {}, userId) {
  if (!agentId) throw new Error("agentId is required");
  const conv = await readConversation({ agentId }, userId);
  const msgs = conv?.messages || [];
  const lastAssistantIdx = msgs.findLastIndex((m) => m.type === "assistant_message");
  return { queued: msgs.slice(lastAssistantIdx + 1).filter((m) => m.type === "user_message") };
}

/**
 * Create a new Cursor cloud agent.
 * @param {{ repository: string, ref: string, prompt?: string }} input
 * @param {string} [userId]
 */
export async function writeAgent({ repository, ref, prompt } = {}, userId) {
  if (!repository) throw new Error("repository is required");
  if (!ref) throw new Error("ref is required");
  const key = await getApiKey(userId);
  if (!key) throw new Error("Missing CURSOR_API_KEY");
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Authorization: makeAuthHeader(key),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: { text: prompt || "Wait for initialization instructions." },
      source: { repository, ref },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cursor API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Session-health probe — pre-dispatch check that the upstream Cursor session
// matches what the adventurers DB row says, and is in a state that can accept
// a followup. Reconciles drift (DB says idle, upstream says EXPIRED, etc.).
// ---------------------------------------------------------------------------

/**
 * Probe one adventurer's session against the Cursor API and reconcile the DB.
 *
 * Returns:
 *   {
 *     upstream_status: 'RUNNING' | 'FINISHED' | 'EXPIRED' | 'CREATING' | 'ERROR' | <other>,
 *     alive: boolean,            // upstream session exists at all
 *     dispatch_safe: boolean,    // followup is expected to land (FINISHED/RUNNING/CREATING ok; EXPIRED not)
 *     was_drift: boolean,        // db.session_status differed from upstream
 *     adventurer: { id, name, session_id, session_status }, // post-sync row
 *   }
 *
 * Drift handling: if upstream returns a status the local DB doesn't reflect
 * accurately, this updates `adventurers.session_status` to a normalized
 * "idle" (dispatch-safe) or "expired" (needs respawn) value. Does NOT auto-
 * respawn — caller decides.
 *
 * @param {{ adventurerId?: string, adventurerName?: string }} input — pass one
 * @param {string} [userId]
 */
export async function syncSessionStatus({ adventurerId, adventurerName } = {}, userId) {
  if (!adventurerId && !adventurerName) {
    throw new Error("syncSessionStatus: pass adventurerId or adventurerName");
  }
  const db = await database.init("service");
  const q = db.from("adventurers").select("id, name, session_id, session_status, worker_type").limit(1);
  const { data: rows } = await (adventurerId ? q.eq("id", adventurerId) : q.eq("name", adventurerName));
  const adv = rows?.[0];
  if (!adv) throw new Error(`syncSessionStatus: adventurer not found (${adventurerId || adventurerName})`);
  if (!adv.session_id) {
    return {
      upstream_status: "no_session",
      alive: false,
      dispatch_safe: false,
      was_drift: false,
      adventurer: adv,
    };
  }

  let upstreamStatus = "unknown";
  let alive = false;
  try {
    const j = await cursorFetch(`/${adv.session_id}`, {}, userId);
    upstreamStatus = String(j?.status || "unknown");
    alive = true;
  } catch (err) {
    // Cursor API returns 404 / 410 for hard-deleted sessions; surface that
    upstreamStatus = "deleted_or_unreachable";
    alive = false;
  }

  // Normalize to DB-friendly status. dispatch_safe: can a followup land?
  const dispatch_safe =
    alive && (upstreamStatus === "RUNNING" || upstreamStatus === "FINISHED" || upstreamStatus === "CREATING");
  const desiredDbStatus = dispatch_safe
    ? "idle"
    : upstreamStatus === "EXPIRED"
      ? "expired"
      : "unreachable";

  const was_drift = adv.session_status !== desiredDbStatus;
  if (was_drift) {
    await db.from("adventurers").update({ session_status: desiredDbStatus }).eq("id", adv.id);
  }

  return {
    upstream_status: upstreamStatus,
    alive,
    dispatch_safe,
    was_drift,
    adventurer: { ...adv, session_status: desiredDbStatus },
  };
}

// ---------------------------------------------------------------------------
// Environment setup helper (for fresh agent sessions)
// ---------------------------------------------------------------------------

/**
 * Generate the env setup instructions for a fresh Cursor agent session.
 * Reads required env vars from profiles and formats them for the agent.
 * @param {{ userId: string, envVarKeys?: string[] }} input
 */
export async function readEnvSetupInstructions({ userId, envVarKeys } = {}) {
  if (!userId) throw new Error("userId is required");
  const db = await database.init("service");
  const { data } = await db
    .from("profiles")
    .select("env_vars")
    .eq("id", userId)
    .single();

  const ev = data?.env_vars || {};
  const keys = Array.isArray(envVarKeys) && envVarKeys.length > 0
    ? envVarKeys
    : [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SECRETE_KEY",
        "OPENAI_API_KEY",
        "PIGEON_API_KEY",
        "PIGEON_POST_OWNER_ID",
      ];

  const lines = [];
  for (const k of keys) {
    const val = ev[k] || process.env[k] || "";
    if (val) lines.push(`${k}=${val}`);
  }

  return {
    envFileContent: lines.join("\n"),
    setupScript: [
      "npm install && npx playwright install chromium --with-deps && npm install -g @anthropic-ai/claude-code",
      `cat > .env.local << 'ENVEOF'\n${lines.join("\n")}\nENVEOF`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    const key = await getApiKey(userId);
    if (key) {
      return { ok: true, msg: "CURSOR_API_KEY is set" };
    }
    return {
      ok: false,
      msg: "Missing CURSOR_API_KEY — add it to your profile env_vars in Council Hall > Formulary.",
    };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message}` };
  }
}
