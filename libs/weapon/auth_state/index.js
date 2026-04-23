/**
 * Auth State weapon — browser auth state management.
 *
 * Manages saved auth state (cookies/localStorage) exported by scripts/auth-capture.mjs.
 * Used by cloud agents that can't connect to the local CDP Chrome.
 * Default state file: playwright/.auth/user.json
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_STATE_PATH = join(process.cwd(), "playwright/.auth/user.json");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default expiry

// ---------------------------------------------------------------------------
// Read state
// ---------------------------------------------------------------------------

/**
 * Read the current auth state file.
 * @param {{ statePath?: string }} input
 * @returns {Promise<{ state: object|null, path: string, exists: boolean, age: number|null, expired: boolean }>}
 */
export async function readState({ statePath } = {}) {
  const path = statePath || DEFAULT_STATE_PATH;
  try {
    const stats = await stat(path);
    const age = Date.now() - stats.mtimeMs;
    const content = await readFile(path, "utf-8");
    const state = JSON.parse(content);
    const cookieCount = Array.isArray(state.cookies) ? state.cookies.length : 0;
    const originCount = Array.isArray(state.origins) ? state.origins.length : 0;

    return {
      state,
      path,
      exists: true,
      age,
      expired: age > MAX_AGE_MS,
      cookieCount,
      originCount,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return { state: null, path, exists: false, age: null, expired: true, cookieCount: 0, originCount: 0, lastModified: null };
  }
}

/**
 * Check which services have active cookies in the auth state.
 * @param {{ statePath?: string }} input
 * @returns {Promise<{ services: Array<{ domain: string, cookieCount: number, hasExpired: boolean }> }>}
 */
export async function searchServices({ statePath } = {}) {
  const { state } = await readState({ statePath });
  if (!state || !Array.isArray(state.cookies)) return { services: [] };

  const byDomain = new Map();
  const now = Date.now() / 1000;

  for (const cookie of state.cookies) {
    const domain = (cookie.domain || "").replace(/^\./, "");
    if (!domain) continue;
    const entry = byDomain.get(domain) || { domain, cookieCount: 0, hasExpired: false };
    entry.cookieCount++;
    if (cookie.expires && cookie.expires > 0 && cookie.expires < now) {
      entry.hasExpired = true;
    }
    byDomain.set(domain, entry);
  }

  return { services: Array.from(byDomain.values()).sort((a, b) => b.cookieCount - a.cookieCount) };
}

// ---------------------------------------------------------------------------
// Write state
// ---------------------------------------------------------------------------

/**
 * Save auth state to file.
 * @param {{ state: object, statePath?: string }} input
 */
export async function writeState({ state, statePath } = {}) {
  if (!state) throw new Error("state object is required");
  const path = statePath || DEFAULT_STATE_PATH;
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
  return { ok: true, path };
}

// ---------------------------------------------------------------------------
// Expiry check
// ---------------------------------------------------------------------------

/**
 * Check if auth state needs refresh (expired cookies or stale file).
 * @param {{ statePath?: string, maxAgeMs?: number }} input
 * @returns {Promise<{ needsRefresh: boolean, reason: string|null, expiredDomains: string[] }>}
 */
export async function readExpiryStatus({ statePath, maxAgeMs } = {}) {
  const maxAge = maxAgeMs || MAX_AGE_MS;
  const { state, exists, age, expired } = await readState({ statePath });

  if (!exists) return { needsRefresh: true, reason: "State file does not exist", expiredDomains: [] };
  if (age > maxAge) return { needsRefresh: true, reason: `State file is ${Math.round(age / 3600000)}h old (max: ${Math.round(maxAge / 3600000)}h)`, expiredDomains: [] };

  // Check individual cookie expiry
  const now = Date.now() / 1000;
  const expiredDomains = new Set();
  if (state && Array.isArray(state.cookies)) {
    for (const cookie of state.cookies) {
      if (cookie.expires && cookie.expires > 0 && cookie.expires < now) {
        expiredDomains.add((cookie.domain || "").replace(/^\./, ""));
      }
    }
  }

  if (expiredDomains.size > 0) {
    return {
      needsRefresh: true,
      reason: `Expired cookies for: ${Array.from(expiredDomains).join(", ")}`,
      expiredDomains: Array.from(expiredDomains),
    };
  }

  return { needsRefresh: false, reason: null, expiredDomains: [] };
}

// ---------------------------------------------------------------------------
// Delete (clear state)
// ---------------------------------------------------------------------------

/**
 * Delete the auth state file.
 * @param {{ statePath?: string }} input
 */
export async function deleteState({ statePath } = {}) {
  const path = statePath || DEFAULT_STATE_PATH;
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(path);
    return { ok: true, deleted: path };
  } catch {
    return { ok: true, deleted: null, msg: "File did not exist" };
  }
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  const { exists, expired, cookieCount, lastModified } = await readState();
  if (!exists) {
    return { ok: false, msg: "No auth state JSON — run scripts/auth-capture.mjs to create one." };
  }
  if (expired) {
    return { ok: false, msg: `Auth state expired (last modified: ${lastModified}). Re-run scripts/auth-capture.mjs.` };
  }
  return { ok: true, msg: `Auth state valid — ${cookieCount} cookies, last modified: ${lastModified}` };
}
