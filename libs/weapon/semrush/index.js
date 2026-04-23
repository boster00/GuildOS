import { database } from "@/libs/council/database";

const BASE = "https://api.semrush.com";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.SEMRUSH_API_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.SEMRUSH_API_KEY || null;
}

async function request(params, key) {
  const url = new URL(BASE);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEMRush API failed (${res.status}): ${text}`);
  }
  return res.text();
}

export async function readDomainOverview({ domain, database: db = "us" } = {}, userId) {
  if (!domain) throw new Error('"domain" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("SEMRUSH_API_KEY not set");
  const raw = await request({ type: "domain_ranks", domain, database: db, export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac" }, key);
  return { raw };
}

export async function searchKeywords({ phrase, database: db = "us", limit = 10 } = {}, userId) {
  if (!phrase) throw new Error('"phrase" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("SEMRUSH_API_KEY not set");
  const raw = await request({
    type: "phrase_related",
    phrase,
    database: db,
    display_limit: limit,
    export_columns: "Ph,Nq,Cp,Co,Nr",
  }, key);
  return { raw };
}

export async function readBacklinks({ target, limit = 10 } = {}, userId) {
  if (!target) throw new Error('"target" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("SEMRUSH_API_KEY not set");
  const raw = await request({
    type: "backlinks",
    target,
    target_type: "root_domain",
    display_limit: limit,
    export_columns: "page_ascore,source_url,target_url,anchor,external_num,internal_num,first_seen,last_seen",
  }, key);
  return { raw };
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "SEMRUSH_API_KEY not set in profiles.env_vars or process.env" };
  try {
    await request({ type: "domain_ranks", domain: "semrush.com", database: "us", export_columns: "Dn" }, key);
    return { ok: true, msg: "SEMRush credentials valid" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
