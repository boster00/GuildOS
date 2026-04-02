import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";

/** Reasonable env-var name: letters, digits, underscore; must not start with digit. */
const ENV_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MAX_KEYS = 80;

export function isValidEnvVarKey(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (RESERVED_KEYS.has(name)) return false;
  return ENV_VAR_NAME_RE.test(name);
}

function normalizeEnvVars(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!isValidEnvVarKey(k)) continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Key names only — never values (for API GET / UI).
 * @param {Record<string, unknown>|null|undefined} env_vars
 * @returns {string[]}
 */
export function listEnvVarKeyNames(env_vars) {
  const n = normalizeEnvVars(env_vars);
  return Object.keys(n)
    .filter((k) => n[k].length > 0)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {Record<string, unknown>} current
 * @param {{ set?: Record<string, string>, remove?: string[] }} mutation
 * @returns {{ next: Record<string, string>, error?: string }}
 */
export function applyEnvVarsMutation(current, mutation) {
  const set = mutation.set && typeof mutation.set === "object" && !Array.isArray(mutation.set) ? mutation.set : {};
  const remove = Array.isArray(mutation.remove) ? mutation.remove : [];

  const base = normalizeEnvVars(current);

  for (const key of remove) {
    if (!isValidEnvVarKey(key)) {
      return { next: base, error: `Invalid key in remove: ${key}` };
    }
    delete base[key];
  }

  for (const [rawKey, rawVal] of Object.entries(set)) {
    if (!isValidEnvVarKey(rawKey)) {
      return { next: base, error: `Invalid key in set: ${rawKey}` };
    }
    if (typeof rawVal !== "string") {
      return { next: base, error: `Value for ${rawKey} must be a string` };
    }
    const val = rawVal.trim();
    if (val.length === 0) {
      delete base[rawKey];
    } else {
      base[rawKey] = val;
    }
  }

  const keyCount = Object.keys(base).length;
  if (keyCount > MAX_KEYS) {
    return { next: base, error: `At most ${MAX_KEYS} variables allowed` };
  }

  return { next: base };
}

/**
 * Zoho Books OAuth app credentials: `profiles.env_vars` overrides `process.env` when set.
 * User access/refresh tokens are **not** here—they live in `potions` (see weapon zoho connection).
 *
 * @param {string} userId
 * @returns {Promise<{
 *   clientId: string,
 *   clientSecret: string,
 *   sources: { clientId: string, clientSecret: string },
 *   profileRowReadOk: boolean,
 *   profileReadError: string | null,
 * }>}
 */
export async function getZohoBooksAppCredentials(userId) {
  const db = await database.init("server");
  const { data, error } = await db
    .from(publicTables.profiles)
    .select("env_vars")
    .eq("id", userId)
    .maybeSingle();

  const ev = !error ? normalizeEnvVars(data?.env_vars) : {};

  const fromProfileId = (ev.ZOHO_BOOKS_CLIENT_ID || "").trim();
  const fromProfileSecret = (ev.ZOHO_BOOKS_CLIENT_SECRET || "").trim();

  const clientId = fromProfileId || (process.env.ZOHO_BOOKS_CLIENT_ID || "").trim();
  const clientSecret = fromProfileSecret || (process.env.ZOHO_BOOKS_CLIENT_SECRET || "").trim();

  return {
    clientId,
    clientSecret,
    sources: {
      clientId: fromProfileId ? "profiles.env_vars" : "process.env",
      clientSecret: fromProfileSecret ? "profiles.env_vars" : "process.env",
    },
    profileRowReadOk: !error,
    profileReadError: error ? error.message : null,
  };
}
