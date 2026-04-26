/**
 * Auth State weapon — browser auth state management.
 *
 * Manages saved auth state (cookies/localStorage) exported by scripts/auth-capture.mjs.
 * Used by cloud agents that can't connect to the local CDP Chrome.
 * Default state file: playwright/.auth/user.json
 */

export const toc = {
  readState: "Read the Playwright auth state for a named service.",
  searchServices: "Search stored auth-state services by name.",
  writeState: "Write a Playwright auth state blob for a service.",
  readExpiryStatus: "Read the auth-state expiry status (fresh / stale).",
  deleteState: "Delete a stored auth state for a service.",
  uploadBundle:
    "Upload the local Playwright storageState file to Supabase Storage so cursor cloud agents (which can't reach the local filesystem) can pull it on init. Local-side action.",
  downloadBundle:
    "Download the latest auth-state bundle from Supabase Storage and write it to disk in the cursor agent's filesystem. Cursor-side action; pair with Playwright's storageState option.",
};
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
// Distribution: local → Supabase Storage → cursor cloud agents
//
// The local user runs `auth-capture.mjs` to log into services interactively
// and produce `playwright/.auth/user.json`. Cursor agents can't reach the local
// filesystem, so we put the bundle in a private Supabase bucket location keyed
// by ownerId and let the agents pull it on init via downloadBundle.
// ---------------------------------------------------------------------------

const BUNDLE_BUCKET = "GuildOS_Bucket";
const BUNDLE_PATH = (ownerId) => `auth_bundles/${ownerId}/storageState.json`;

/**
 * Upload the local storageState JSON to Supabase Storage so cloud agents can
 * pull it. Local-side action (run from the user's machine after auth-capture).
 *
 * @param {{ ownerId: string, statePath?: string }} input
 * @returns {Promise<{ ok: true, path: string, sizeBytes: number, lastModified: string }>}
 */
export async function uploadBundle({ ownerId, statePath } = {}) {
  if (!ownerId) throw new Error("ownerId is required");
  const local = statePath || DEFAULT_STATE_PATH;
  const buf = await readFile(local);
  const stats = await stat(local);

  // Use the supabase_storage weapon — same convention as quest items.
  const { writeFile: writeStorageFile } = await import("@/libs/weapon/supabase_storage");
  const path = BUNDLE_PATH(ownerId);
  await writeStorageFile({
    path,
    content: buf,
    contentType: "application/json",
    bucket: BUNDLE_BUCKET,
    upsert: true,
  });
  return {
    ok: true,
    path,
    sizeBytes: buf.length,
    lastModified: stats.mtime.toISOString(),
  };
}

/**
 * Download the auth bundle for the given ownerId from Supabase Storage and
 * write it to local disk. Cursor-side action — call once during agent init,
 * then point Playwright at the resulting path via `storageState`.
 *
 * @param {{ ownerId: string, statePath?: string }} input
 * @returns {Promise<{ ok: true, path: string, sizeBytes: number }>}
 */
export async function downloadBundle({ ownerId, statePath } = {}) {
  if (!ownerId) throw new Error("ownerId is required");
  const dest = statePath || DEFAULT_STATE_PATH;

  const { readFile: readStorageFile } = await import("@/libs/weapon/supabase_storage");
  const path = BUNDLE_PATH(ownerId);
  const { content } = await readStorageFile({ path, bucket: BUNDLE_BUCKET });
  if (!content) {
    return { ok: false, msg: `No auth bundle at ${path}. Have the user run scripts/auth-capture.mjs --upload.` };
  }
  // Buffer or string both fine; ensure dir exists then write.
  const { mkdir, writeFile: writeFsFile } = await import("node:fs/promises");
  const { dirname: pathDirname } = await import("node:path");
  await mkdir(pathDirname(dest), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  await writeFsFile(dest, buf);
  return { ok: true, path: dest, sizeBytes: buf.length };
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
