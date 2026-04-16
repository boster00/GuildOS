/**
 * Figma weapon — Figma REST API connector for reading files, exporting assets,
 * and listing projects.
 *
 * Auth: FIGMA_ACCESS_TOKEN from profiles.env_vars or process.env.
 */
import { database } from "@/libs/council/database";

const API_BASE = "https://api.figma.com/v1";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getToken(userId) {
  if (process.env.FIGMA_ACCESS_TOKEN) return process.env.FIGMA_ACCESS_TOKEN;
  if (!userId) return null;
  const db = await database.init("service");
  const { data } = await db
    .from("profiles")
    .select("env_vars")
    .eq("id", userId)
    .single();
  return data?.env_vars?.FIGMA_ACCESS_TOKEN ?? null;
}

async function figmaFetch(path, opts = {}, userId) {
  const token = await getToken(userId);
  if (!token) throw new Error("Missing FIGMA_ACCESS_TOKEN");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Figma-Token": token,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * Read a Figma file's metadata and structure.
 * @param {{ fileKey: string, depth?: number }} input
 * @param {string} [userId]
 */
export async function readFile({ fileKey, depth } = {}, userId) {
  if (!fileKey) throw new Error("fileKey is required");
  const params = new URLSearchParams();
  if (depth != null) params.set("depth", String(depth));
  return figmaFetch(`/files/${fileKey}?${params}`, {}, userId);
}

/**
 * Read specific nodes from a Figma file.
 * @param {{ fileKey: string, nodeIds: string[] }} input
 * @param {string} [userId]
 */
export async function readNodes({ fileKey, nodeIds } = {}, userId) {
  if (!fileKey) throw new Error("fileKey is required");
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) throw new Error("nodeIds is required");
  const params = new URLSearchParams({ ids: nodeIds.join(",") });
  return figmaFetch(`/files/${fileKey}/nodes?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export renderings of nodes as images.
 * @param {{ fileKey: string, nodeIds: string[], format?: string, scale?: number }} input
 * @param {string} [userId]
 * @returns {Promise<{ images: Record<string, string> }>} — node ID to image URL map
 */
export async function readExport({ fileKey, nodeIds, format = "png", scale = 2 } = {}, userId) {
  if (!fileKey) throw new Error("fileKey is required");
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) throw new Error("nodeIds is required");
  const params = new URLSearchParams({
    ids: nodeIds.join(","),
    format,
    scale: String(scale),
  });
  return figmaFetch(`/images/${fileKey}?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Projects & Team
// ---------------------------------------------------------------------------

/**
 * List projects in a team.
 * @param {{ teamId: string }} input
 * @param {string} [userId]
 */
export async function searchProjects({ teamId } = {}, userId) {
  if (!teamId) throw new Error("teamId is required");
  return figmaFetch(`/teams/${teamId}/projects`, {}, userId);
}

/**
 * List files in a project.
 * @param {{ projectId: string }} input
 * @param {string} [userId]
 */
export async function searchFiles({ projectId } = {}, userId) {
  if (!projectId) throw new Error("projectId is required");
  return figmaFetch(`/projects/${projectId}/files`, {}, userId);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Read comments on a file.
 * @param {{ fileKey: string }} input
 * @param {string} [userId]
 */
export async function readComments({ fileKey } = {}, userId) {
  if (!fileKey) throw new Error("fileKey is required");
  return figmaFetch(`/files/${fileKey}/comments`, {}, userId);
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    const token = await getToken(userId);
    if (token) {
      return { ok: true, msg: "FIGMA_ACCESS_TOKEN is set" };
    }
    return {
      ok: false,
      msg: "Missing FIGMA_ACCESS_TOKEN — generate a personal access token at figma.com/developers and add it to profile env_vars.",
    };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message}` };
  }
}
