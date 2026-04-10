/**
 * Vercel weapon — manages deployments, projects, domains, and env vars
 * via the Vercel REST API v9.
 *
 * Auth: VERCEL_API_KEY from profiles.env_vars or process.env.
 */
import { database } from "@/libs/council/database";

const API_BASE = "https://api.vercel.com";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getApiKey(userId) {
  if (process.env.VERCEL_API_KEY) return process.env.VERCEL_API_KEY;
  if (!userId) return null;
  const db = await database.init("service");
  const { data } = await db
    .from("profiles")
    .select("env_vars")
    .eq("id", userId)
    .single();
  return data?.env_vars?.VERCEL_API_KEY ?? null;
}

async function vercelFetch(path, opts = {}, userId) {
  const token = await getApiKey(userId);
  if (!token) throw new Error("Missing VERCEL_API_KEY");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects({ teamId, limit = 20 } = {}, userId) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(`/v9/projects?${params}`, {}, userId);
}

export async function getProject({ projectId, teamId } = {}, userId) {
  if (!projectId) throw new Error("projectId required");
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(`/v9/projects/${projectId}?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

export async function listDeployments(
  { projectId, teamId, limit = 20, state } = {},
  userId,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId) params.set("projectId", projectId);
  if (teamId) params.set("teamId", teamId);
  if (state) params.set("state", state);
  return vercelFetch(`/v6/deployments?${params}`, {}, userId);
}

export async function getDeployment({ deploymentId, teamId } = {}, userId) {
  if (!deploymentId) throw new Error("deploymentId required");
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(`/v13/deployments/${deploymentId}?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export async function listDomains({ teamId, limit = 20 } = {}, userId) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(`/v5/domains?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Environment variables
// ---------------------------------------------------------------------------

export async function listEnvVars({ projectId, teamId } = {}, userId) {
  if (!projectId) throw new Error("projectId required");
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(
    `/v9/projects/${projectId}/env?${params}`,
    {},
    userId,
  );
}

export async function createEnvVar(
  { projectId, teamId, key, value, target = ["production", "preview", "development"], type = "encrypted" } = {},
  userId,
) {
  if (!projectId || !key || !value) throw new Error("projectId, key, value required");
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);
  return vercelFetch(
    `/v10/projects/${projectId}/env?${params}`,
    { method: "POST", body: JSON.stringify({ key, value, target, type }) },
    userId,
  );
}

// ---------------------------------------------------------------------------
// Redeploy
// ---------------------------------------------------------------------------

export async function redeploy({ deploymentId, teamId, target } = {}, userId) {
  if (!deploymentId) throw new Error("deploymentId required");
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);
  const body = {};
  if (target) body.target = target;
  return vercelFetch(
    `/v13/deployments/${deploymentId}/redeploy?${params}`,
    { method: "POST", body: JSON.stringify(body) },
    userId,
  );
}

// ---------------------------------------------------------------------------
// User / Team info
// ---------------------------------------------------------------------------

export async function getUser(userId) {
  return vercelFetch("/v2/user", {}, userId);
}

export async function listTeams({ limit = 20 } = {}, userId) {
  const params = new URLSearchParams({ limit: String(limit) });
  return vercelFetch(`/v2/teams?${params}`, {}, userId);
}

// ---------------------------------------------------------------------------
// Credential check (no external call)
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    const key = await getApiKey(userId);
    if (key) {
      return { ok: true, msg: "VERCEL_API_KEY is set" };
    }
    return {
      ok: false,
      msg: "Missing VERCEL_API_KEY — add it to your profile env_vars in Council Hall > Formulary, or set it in .env.local",
    };
  } catch (e) {
    return { ok: false, msg: `Error checking credentials: ${e.message}` };
  }
}
