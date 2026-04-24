export const toc = {
  searchCampaigns: "Search Instantly cold-email campaigns.",
  readCampaign: "Read a single Instantly campaign by id.",
  readAnalytics: "Read Instantly campaign analytics.",
  readLeads: "Read leads in an Instantly campaign.",
};

import { database } from "@/libs/council/database";

// Instantly API v2 — Bearer token auth.
// Key created 2026-04-19 via UI (GuildOS key, all:all scope).
// V1 API uses ?api_key= param but is deprecated; V2 uses Bearer Authorization header.

const BASE_V2 = "https://api.instantly.ai/api/v2";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.INSTANTLY_API_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.INSTANTLY_API_KEY || null;
}

async function request(path, key, params = {}, method = "GET", body) {
  const url = new URL(`${BASE_V2}${path}`);
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const opts = {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url.toString(), opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instantly ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchCampaigns({ limit = 10, skip = 0 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/campaigns", key, { limit, starting_after: skip > 0 ? skip : undefined });
}

export async function readCampaign({ id } = {}, userId) {
  if (!id) throw new Error('"id" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request(`/campaigns/${id}`, key);
}

export async function readAnalytics({ campaignId } = {}, userId) {
  if (!campaignId) throw new Error('"campaignId" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request(`/campaigns/${campaignId}/analytics/overview`, key);
}

export async function readLeads({ campaignId, limit = 10, skip = 0 } = {}, userId) {
  if (!campaignId) throw new Error('"campaignId" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/leads", key, { campaign_id: campaignId, limit });
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "INSTANTLY_API_KEY not set in profiles.env_vars or process.env" };
  try {
    const data = await request("/campaigns", key, { limit: 1 });
    return { ok: true, msg: `Instantly credentials valid — ${data?.items?.length ?? 0} campaigns accessible` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
