/**
 * Supabase Storage weapon — unified upload/download with path conventions.
 *
 * Auth: Uses SUPABASE_SECRETE_KEY via database service role.
 * Bucket: GuildOS_Bucket (public)
 */
import { database } from "@/libs/council/database";

const DEFAULT_BUCKET = "GuildOS_Bucket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getClient() {
  return database.init("service");
}

/**
 * Build a standardized storage path.
 * Convention: {channel}/{questId}/{filename}
 * @param {{ channel?: string, questId?: string, filename: string }} input
 */
export function buildPath({ channel = "general", questId, filename }) {
  if (!filename) throw new Error("filename is required");
  const parts = [channel];
  if (questId) parts.push(questId);
  parts.push(filename);
  return parts.join("/");
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file to Supabase Storage.
 * @param {{ path: string, content: Buffer|Blob|string, contentType?: string, bucket?: string, upsert?: boolean }} input
 */
export async function writeFile({ path, content, contentType = "application/octet-stream", bucket = DEFAULT_BUCKET, upsert = true } = {}) {
  if (!path) throw new Error("path is required");
  if (!content) throw new Error("content is required");
  const db = await getClient();
  const { data, error } = await db.storage
    .from(bucket)
    .upload(path, content, { contentType, upsert });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { path: data?.path || path, fullPath: data?.fullPath || path };
}

/**
 * Get the public URL for a stored file.
 * @param {{ path: string, bucket?: string }} input
 */
export function readPublicUrl({ path, bucket = DEFAULT_BUCKET } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return {
    url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
  };
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Download a file from Supabase Storage.
 * @param {{ path: string, bucket?: string }} input
 */
export async function readFile({ path, bucket = DEFAULT_BUCKET } = {}) {
  if (!path) throw new Error("path is required");
  const db = await getClient();
  const { data, error } = await db.storage
    .from(bucket)
    .download(path);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return { blob: data, path };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List files in a storage path.
 * @param {{ path?: string, bucket?: string, limit?: number }} input
 */
export async function searchFiles({ path = "", bucket = DEFAULT_BUCKET, limit = 100 } = {}) {
  const db = await getClient();
  const { data, error } = await db.storage
    .from(bucket)
    .list(path, { limit, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(`Storage list failed: ${error.message}`);
  return { files: data || [] };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete files from Supabase Storage.
 * @param {{ paths: string[], bucket?: string }} input
 */
export async function deleteFiles({ paths, bucket = DEFAULT_BUCKET } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths array is required");
  const db = await getClient();
  const { error } = await db.storage
    .from(bucket)
    .remove(paths);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
  return { ok: true, deleted: paths.length };
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRETE_KEY;
    if (!url) return { ok: false, msg: "Missing NEXT_PUBLIC_SUPABASE_URL" };
    if (!key) return { ok: false, msg: "Missing SUPABASE_SECRETE_KEY" };
    return { ok: true, msg: "Supabase Storage credentials present" };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message}` };
  }
}
