import { publicTables } from "@/libs/council/publicTables";

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function normalizeCouncilSettings(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

/**
 * @param {unknown} raw
 * @returns {{ api_key?: string, base_url?: string, model_id?: string }}
 */
export function normalizeDungeonMasterSlice(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = /** @type {Record<string, unknown>} */ (raw);
  const out = {};
  if (typeof o.api_key === "string" && o.api_key.trim()) out.api_key = o.api_key.trim();
  if (typeof o.base_url === "string" && o.base_url.trim()) out.base_url = o.base_url.trim();
  if (typeof o.model_id === "string" && o.model_id.trim()) out.model_id = o.model_id.trim();
  return out;
}

/**
 * Safe for JSON responses: never includes api_key value.
 * @param {unknown} council_settings
 */
export function dungeonMasterForClient(council_settings) {
  const cs = normalizeCouncilSettings(council_settings);
  const dm = normalizeDungeonMasterSlice(cs.dungeon_master);
  return {
    has_api_key: Boolean(dm.api_key),
    base_url: dm.base_url || "",
    model_id: dm.model_id || "",
  };
}

/**
 * @param {unknown} currentCouncil
 * @param {{ api_key?: string, base_url?: string, model_id?: string, clear_api_key?: boolean }} patch
 * @returns {{ next: Record<string, unknown>, error?: string }}
 */
export function applyDungeonMasterPatch(currentCouncil, patch) {
  const base = normalizeCouncilSettings(currentCouncil);
  const prevDm = normalizeDungeonMasterSlice(base.dungeon_master);
  const nextDm = { ...prevDm };

  if (patch.clear_api_key === true) {
    delete nextDm.api_key;
  }

  if (patch.api_key !== undefined) {
    const v = typeof patch.api_key === "string" ? patch.api_key.trim() : "";
    if (v.length === 0) {
      delete nextDm.api_key;
    } else {
      nextDm.api_key = v;
    }
  }

  if (patch.base_url !== undefined) {
    const v = typeof patch.base_url === "string" ? patch.base_url.trim() : "";
    if (v.length === 0) {
      delete nextDm.base_url;
    } else {
      try {
        new URL(v);
      } catch {
        return { next: base, error: "base_url must be a valid URL" };
      }
      nextDm.base_url = v;
    }
  }

  if (patch.model_id !== undefined) {
    const v = typeof patch.model_id === "string" ? patch.model_id.trim() : "";
    if (v.length === 0) {
      delete nextDm.model_id;
    } else {
      if (v.length > 200) {
        return { next: base, error: "model_id is too long" };
      }
      nextDm.model_id = v;
    }
  }

  const keys = Object.keys(nextDm);
  if (keys.length === 0) {
    const { dungeon_master: _drop, ...rest } = base;
    return { next: rest };
  }

  return { next: { ...base, dungeon_master: nextDm } };
}

/**
 * Resolved credentials for @openai/agents (env fallback when profile omits key).
 * @param {string} ownerId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} injected
 */
export async function resolveDungeonMasterRuntime(ownerId, { client }) {
  const { data: row, error } = await client
    .from(publicTables.profiles)
    .select("council_settings")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) {
    return { error, apiKey: null, baseUrl: undefined, defaultModel: null, apiKeySource: null };
  }

  const dm = normalizeDungeonMasterSlice(row?.council_settings?.dungeon_master);
  const fromProfile = dm.api_key && String(dm.api_key).trim();

  // After profile: fall back to env in order (same as typical .env.local primary + spare key).
  const envKeyPrimary = (process.env.OPENAI_API_KEY || "").trim();
  const envKeyAlt = (process.env.OPENAI_API_KEY_1 || "").trim();
  const fromEnv = envKeyPrimary || envKeyAlt || "";

  const apiKey = (fromProfile || fromEnv) || null;

  /** @type {'profile' | 'env' | null} */
  let apiKeySource = null;
  if (apiKey) {
    apiKeySource = fromProfile ? "profile" : "env";
  }

  const baseUrl = dm.base_url && String(dm.base_url).trim() ? String(dm.base_url).trim() : undefined;
  const defaultModel = dm.model_id && String(dm.model_id).trim() ? String(dm.model_id).trim() : null;

  return {
    error: null,
    apiKey,
    baseUrl,
    defaultModel,
    apiKeySource,
  };
}
