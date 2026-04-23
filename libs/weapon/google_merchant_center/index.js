import { getGoogleCredentials } from "@/libs/council/profileEnvVars";
import { database } from "@/libs/council/database";

const BASE = "https://shoppingcontent.googleapis.com/content/v2.1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/content";

async function resolveUserId(explicit) {
  if (explicit) return explicit;
  try {
    const { getAdventurerExecutionUserId } = await import("@/libs/adventurer/advance.js");
    const ctxId = getAdventurerExecutionUserId();
    if (ctxId) return ctxId;
  } catch { /* not in adventurer context */ }
  const { requireUser } = await import("@/libs/council/auth/server");
  const user = await requireUser();
  return user.id;
}

async function loadMerchantId(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const m = data?.env_vars?.GOOGLE_MERCHANT_ID;
      if (m) return m;
    } catch { /* fall through */ }
  }
  return process.env.GOOGLE_MERCHANT_ID || null;
}

async function getServiceAccountKey(userId) {
  const creds = await getGoogleCredentials(userId);
  const raw = creds.serviceAccountJson;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT is not set in profiles.env_vars or process.env.");
  const key = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT missing client_email or private_key.");
  }
  return key;
}

async function getAccessToken(userId) {
  const key = await getServiceAccountKey(userId);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const crypto = await import("node:crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(key.token_uri || TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function request(path, userId, params = {}) {
  const token = await getAccessToken(userId);
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Merchant Center ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function readAccount({ merchantId } = {}, userId) {
  const uid = await resolveUserId(userId);
  const mid = merchantId || await loadMerchantId(uid);
  if (!mid) throw new Error("merchantId required — set GOOGLE_MERCHANT_ID");
  return request(`/${mid}/accounts/${mid}`, uid);
}

export async function readProducts({ merchantId, maxResults = 10 } = {}, userId) {
  const uid = await resolveUserId(userId);
  const mid = merchantId || await loadMerchantId(uid);
  if (!mid) throw new Error("merchantId required — set GOOGLE_MERCHANT_ID");
  return request(`/${mid}/products`, uid, { maxResults });
}

export async function readOrders({ merchantId, maxResults = 10 } = {}, userId) {
  const uid = await resolveUserId(userId);
  const mid = merchantId || await loadMerchantId(uid);
  if (!mid) throw new Error("merchantId required — set GOOGLE_MERCHANT_ID");
  return request(`/${mid}/orders`, uid, { maxResults });
}

export async function checkCredentials(userId) {
  try {
    const uid = await resolveUserId(userId);
    const creds = await getGoogleCredentials(uid);
    if (!creds.serviceAccountJson) {
      return { ok: false, msg: "GOOGLE_SERVICE_ACCOUNT not set in profiles.env_vars or process.env" };
    }
    const mid = await loadMerchantId(uid);
    if (!mid) {
      return { ok: false, msg: "GOOGLE_MERCHANT_ID not set in profiles.env_vars or process.env" };
    }
    await getAccessToken(uid);
    return { ok: true, msg: `Merchant Center credentials valid (merchant ${mid})` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
