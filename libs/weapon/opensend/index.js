import { database } from "@/libs/council/database";

const BASE = "https://app.opensend.com/api";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.OPENSEND_API_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.OPENSEND_API_KEY || null;
}

export async function searchContacts({ limit = 10 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("OPENSEND_API_KEY not set");
  return {
    ok: true,
    note: "API endpoint TBD — verify at opensend.com/docs",
    params: { limit },
  };
}

export async function writeContact({ email, firstName, lastName, tags } = {}, userId) {
  if (!email) throw new Error('"email" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("OPENSEND_API_KEY not set");
  const res = await fetch(`${BASE}/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, firstName, lastName, tags }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Opensend POST /contacts failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "OPENSEND_API_KEY not set in profiles.env_vars or process.env" };
  return { ok: true, msg: "OPENSEND_API_KEY present — verify endpoint at opensend.com/docs" };
}
