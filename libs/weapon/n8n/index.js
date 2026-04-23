
export const toc = {
  searchWorkflows: "Search N8N workflows.",
  readWorkflow: "Read a single N8N workflow definition.",
  writeExecution: "Trigger an N8N workflow execution.",
  readExecutions: "Read recent executions for a workflow.",
};
import { database } from "@/libs/council/database";

async function loadConfig(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const ev = data?.env_vars ?? {};
      const url = (ev.N8N_URL || "").trim();
      const key = (ev.N8N_API_KEY || "").trim();
      if (url && key) return { url, key };
      if (url || key) return { url: url || process.env.N8N_URL || "", key: key || process.env.N8N_API_KEY || "" };
    } catch { /* fall through */ }
  }
  return {
    url: (process.env.N8N_URL || "").trim(),
    key: (process.env.N8N_API_KEY || "").trim(),
  };
}

async function request(method, path, config, body) {
  const url = `${config.url.replace(/\/$/, "")}/api/v1${path}`;
  const opts = {
    method,
    headers: {
      "X-N8N-API-KEY": config.key,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`N8N ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchWorkflows({ limit = 10, active } = {}, userId) {
  const config = await loadConfig(userId);
  if (!config.url || !config.key) throw new Error("N8N_URL and N8N_API_KEY not set");
  const qs = new URLSearchParams({ limit: String(limit) });
  if (active !== undefined) qs.set("active", String(active));
  return request("GET", `/workflows?${qs}`, config);
}

export async function readWorkflow({ id } = {}, userId) {
  if (!id) throw new Error('"id" is required');
  const config = await loadConfig(userId);
  if (!config.url || !config.key) throw new Error("N8N_URL and N8N_API_KEY not set");
  return request("GET", `/workflows/${id}`, config);
}

export async function writeExecution({ workflowId, data = {} } = {}, userId) {
  if (!workflowId) throw new Error('"workflowId" is required');
  const config = await loadConfig(userId);
  if (!config.url || !config.key) throw new Error("N8N_URL and N8N_API_KEY not set");
  return request("POST", `/workflows/${workflowId}/execute`, config, { data });
}

export async function readExecutions({ workflowId, limit = 10 } = {}, userId) {
  if (!workflowId) throw new Error('"workflowId" is required');
  const config = await loadConfig(userId);
  if (!config.url || !config.key) throw new Error("N8N_URL and N8N_API_KEY not set");
  const qs = new URLSearchParams({ workflowId: String(workflowId), limit: String(limit) });
  return request("GET", `/executions?${qs}`, config);
}

export async function checkCredentials(input = {}, userId) {
  const config = await loadConfig(userId);
  if (!config.url) return { ok: false, msg: "N8N_URL not set in profiles.env_vars or process.env" };
  if (!config.key) return { ok: false, msg: "N8N_API_KEY not set in profiles.env_vars or process.env" };
  try {
    await request("GET", "/workflows?limit=1", config);
    return { ok: true, msg: `N8N credentials valid (${config.url})` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
