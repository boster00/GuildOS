
export const toc = {
  readBalance: "Read the Stripe account balance.",
  readCharges: "Read recent Stripe charges.",
  readCustomers: "Read Stripe customers.",
  readSubscriptions: "Read Stripe subscriptions.",
};
import { database } from "@/libs/council/database";

const BASE = "https://api.stripe.com/v1";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.STRIPE_SECRET_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.STRIPE_SECRET_KEY || null;
}

async function request(path, key, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function readBalance(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return request("/balance", key);
}

export async function readCharges({ limit = 10 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return request("/charges", key, { limit });
}

export async function readCustomers({ limit = 10, email } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return request("/customers", key, { limit, email });
}

export async function readSubscriptions({ limit = 10, status } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return request("/subscriptions", key, { limit, status });
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "STRIPE_SECRET_KEY not set in profiles.env_vars or process.env" };
  try {
    await request("/balance", key);
    return { ok: true, msg: "Stripe credentials valid" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
