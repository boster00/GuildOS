
export const toc = {
  searchCampaigns: "Search Instantly cold-email campaigns.",
  readCampaign: "Read a single Instantly campaign by id.",
  readAnalytics: "Read Instantly campaign analytics.",
  readLeads: "Read leads in an Instantly campaign.",
};
import { database } from "@/libs/council/database";

const BASE = "https://api.instantly.ai/api/v1";

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

async function request(path, key, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instantly ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchCampaigns({ limit = 10, skip = 0 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/campaign/list", key, { limit, skip });
}

export async function readCampaign({ id } = {}, userId) {
  if (!id) throw new Error('"id" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/campaign/get", key, { id });
}

export async function readAnalytics({ campaignId } = {}, userId) {
  if (!campaignId) throw new Error('"campaignId" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/analytics/campaign/summary", key, { id: campaignId });
}

export async function readLeads({ campaignId, limit = 10, skip = 0 } = {}, userId) {
  if (!campaignId) throw new Error('"campaignId" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  return request("/lead/list", key, { campaign_id: campaignId, limit, skip });
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "INSTANTLY_API_KEY not set in profiles.env_vars or process.env" };
  try {
    await request("/campaign/list", key, { limit: 1 });
    return { ok: true, msg: "Instantly credentials valid" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
