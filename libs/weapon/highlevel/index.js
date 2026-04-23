
export const toc = {
  searchContacts: "Search HighLevel CRM contacts.",
  readContact: "Read a single HighLevel contact by id.",
  searchOpportunities: "Search HighLevel pipeline opportunities.",
  writeContact: "Create or update a HighLevel contact.",
};
import { database } from "@/libs/council/database";

const BASE = "https://rest.gohighlevel.com/v1";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.HIGHLEVEL_API_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.HIGHLEVEL_API_KEY || null;
}

async function request(method, path, key, params = {}, body) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url.toString(), opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HighLevel ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchContacts({ query, limit = 20 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("HIGHLEVEL_API_KEY not set");
  return request("GET", "/contacts/search", key, { query, limit });
}

export async function readContact({ id } = {}, userId) {
  if (!id) throw new Error('"id" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("HIGHLEVEL_API_KEY not set");
  return request("GET", `/contacts/${id}`, key);
}

export async function searchOpportunities({ pipelineId, limit = 20 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("HIGHLEVEL_API_KEY not set");
  const params = { limit };
  if (pipelineId) params.pipelineId = pipelineId;
  return request("GET", "/opportunities/search", key, params);
}

export async function writeContact({ email, firstName, lastName, phone } = {}, userId) {
  if (!email) throw new Error('"email" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("HIGHLEVEL_API_KEY not set");
  return request("POST", "/contacts/", key, {}, { email, firstName, lastName, phone });
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "HIGHLEVEL_API_KEY not set in profiles.env_vars or process.env" };
  try {
    await request("GET", "/contacts/search", key, { limit: 1 });
    return { ok: true, msg: "HighLevel credentials valid" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
