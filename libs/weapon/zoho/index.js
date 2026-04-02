/**
 * Zoho Books weapon — single module. Public API: getAccessToken, getList.
 * User identity comes from council (requireUser); tokens live in potions.
 */
import { requireUser } from "@/libs/council/auth/server";
import { getZohoBooksAppCredentials } from "@/libs/council/profileEnvVars";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getSiteUrl } from "@/libs/council/auth/urls";

const ZOHO_KIND = "zoho_books";
const EXPIRY_SKEW_MS = 120_000;

const TOKEN_HOST = {
  com: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  com_au: "https://accounts.zoho.com.au",
  jp: "https://accounts.zoho.jp",
};

const ZOHO_API_BASE = {
  com: "https://www.zohoapis.com",
  eu: "https://www.zohoapis.eu",
  in: "https://www.zohoapis.in",
  com_au: "https://www.zohoapis.com.au",
  jp: "https://www.zohoapis.jp",
};

function rowToLegacyShape(row) {
  if (!row) return null;
  const s = row.secrets && typeof row.secrets === "object" ? row.secrets : {};
  return {
    access_token: s.access_token ?? null,
    refresh_token: s.refresh_token ?? null,
    region: s.region ?? null,
    token_type: s.token_type ?? null,
    expires_at: s.expires_at ?? null,
    organization_id: s.organization_id ?? null,
  };
}

function accessTokenLikelyExpired(expiresAtIso) {
  if (!expiresAtIso || typeof expiresAtIso !== "string") return false;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return false;
  return Date.now() > t - EXPIRY_SKEW_MS;
}

async function getZohoConnection(userId) {
  const db = await database.init("server");
  const { data: row, error } = await db
    .from(publicTables.potions)
    .select("secrets")
    .eq("owner_id", userId)
    .eq("kind", ZOHO_KIND)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read Zoho connection: ${error.message}`);
  }
  return rowToLegacyShape(row);
}

async function upsertZohoConnection(payload) {
  const db = await database.init("server");
  const { user_id, ...rest } = payload;
  const secrets = { ...rest };
  const expiresRaw = secrets.expires_at;
  const expires_at =
    typeof expiresRaw === "string" && expiresRaw.length > 0 ? expiresRaw : null;
  return db.from(publicTables.potions).upsert(
    {
      owner_id: user_id,
      kind: ZOHO_KIND,
      secrets,
      expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,kind" }
  );
}

/** @returns {Record<string, string>} */
function getAuthLinks() {
  const base = getSiteUrl().replace(/\/$/, "");
  return {
    connectZoho: `${base}/api/weapon/zoho?action=connect`,
    inn: `${base}/town/inn`,
    forgeZoho: `${base}/town/town-square/forge/zoho`,
    status: `${base}/api/weapon/zoho?action=status`,
  };
}

function getAuthLinksMessage() {
  const L = getAuthLinks();
  return [
    "Zoho Books is not connected, or the stored session cannot be refreshed.",
    `Open Town square → Forge → Zoho Books and use activation (${L.forgeZoho}), or visit the Inn for quests (${L.inn}).`,
    `Or start OAuth directly: ${L.connectZoho}`,
    `Check connection (JSON): ${L.status}`,
  ].join(" ");
}

/**
 * @param {{ refreshToken: string, region: string, clientId: string, clientSecret: string }} p
 */
async function refreshAccessToken({ refreshToken, region, clientId, clientSecret }) {
  const host = TOKEN_HOST[region] || TOKEN_HOST.com;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(`${host}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
  }

  const token = await response.json();
  return { ok: true, token };
}

async function refreshAndPersist(userId, current) {
  const { clientId, clientSecret } = await getZohoBooksAppCredentials(userId);
  if (!clientId || !clientSecret) {
    const L = getAuthLinks();
    throw new Error(
      `Missing Zoho Books OAuth credentials. ${getAuthLinksMessage()} OAuth app: Council Hall Formulary or env ZOHO_BOOKS_CLIENT_ID / ZOHO_BOOKS_CLIENT_SECRET. Links: ${L.connectZoho}`
    );
  }
  const region = current.region || "com";
  const refreshed = await refreshAccessToken({
    refreshToken: current.refresh_token,
    region,
    clientId,
    clientSecret,
  });
  if (!refreshed.ok) {
    const L = getAuthLinks();
    throw new Error(
      `Zoho token refresh failed (${refreshed.error}). Re-authorize Zoho Books. ${getAuthLinksMessage()} ${L.connectZoho}`
    );
  }
  const t = refreshed.token;
  const expiresAt = new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString();
  const newSecrets = {
    region,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? current.refresh_token,
    token_type: t.token_type ?? current.token_type,
    expires_at: expiresAt,
    organization_id: current.organization_id,
  };
  const { error: upErr } = await upsertZohoConnection({
    user_id: userId,
    ...newSecrets,
  });
  if (upErr) {
    throw new Error(`Could not save refreshed token: ${upErr.message}`);
  }
  return newSecrets;
}

/**
 * @returns {Promise<{ access_token: string, region: string, organization_id: string | null, refresh_token: string | null }>}
 */
async function ensureSecretsForCurrentUser(userId) {
  let current = await getZohoConnection(userId);

  if (!current?.access_token && !current?.refresh_token) {
    const L = getAuthLinks();
    throw new Error(`${getAuthLinksMessage()} Start OAuth: ${L.connectZoho}`);
  }

  const needsRefresh = !current.access_token || accessTokenLikelyExpired(current.expires_at);

  if (needsRefresh) {
    if (!current.refresh_token) {
      const L = getAuthLinks();
      throw new Error(`${getAuthLinksMessage()} ${L.connectZoho}`);
    }
    current = await refreshAndPersist(userId, current);
  }

  if (!current?.access_token) {
    const L = getAuthLinks();
    throw new Error(`${getAuthLinksMessage()} ${L.connectZoho}`);
  }

  return {
    access_token: current.access_token,
    region: current.region || "com",
    organization_id: current.organization_id ?? null,
    refresh_token: current.refresh_token ?? null,
  };
}

/**
 * @returns {Promise<string>} Bearer access token for Zoho Books API.
 */
export async function getAccessToken() {
  const user = await requireUser();
  const s = await ensureSecretsForCurrentUser(user.id);
  return s.access_token;
}

/**
 * @param {string} module - API path segment (e.g. "salesorders", "invoices")
 * @param {number} numOfRecords
 * @returns {Promise<unknown[]>}
 */
export async function getList(module, numOfRecords) {
  const user = await requireUser();
  const secrets = await ensureSecretsForCurrentUser(user.id);
  const region = secrets.region || "com";
  const baseUrl = ZOHO_API_BASE[region] || ZOHO_API_BASE.com;
  const organizationId = secrets.organization_id;

  if (!organizationId) {
    const L = getAuthLinks();
    throw new Error(
      `Zoho organization_id is missing. Re-authorize Zoho Books (callback stores org id). ${getAuthLinksMessage()} ${L.connectZoho}`
    );
  }

  const mod = String(module ?? "").replace(/^\//, "").replace(/\/$/, "");
  if (!mod) {
    throw new Error("getList: module is required.");
  }

  const limit = Math.max(1, Math.min(200, Number(numOfRecords) || 10));

  const url = new URL(`${baseUrl}/books/v3/${encodeURIComponent(mod)}`);
  // Log the URL for diagnostics/tracing what we're fetching from Zoho API
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[Zoho:getList] Fetching ${url.toString()}`);
  }
  url.searchParams.set("organization_id", organizationId);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("sort_column", "date");
  url.searchParams.set("sort_order", "D");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${secrets.access_token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZOHO_FETCH_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  const json = await response.json();
  if (json && typeof json === "object") {
    const arrKey = Object.keys(json).find((k) => Array.isArray(json[k]));
    if (arrKey && Array.isArray(json[arrKey])) {
      return json[arrKey].slice(0, limit);
    }
  }
  return [];
}

/** OAuth callback URL registered with Zoho (must match console + token exchange). */
export function getZohoOAuthCallbackUrl() {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/api/weapon/zoho?action=callback`;
}

async function readZohoSecretsRow(userId) {
  const db = await database.init("server");
  const { data: row, error } = await db
    .from(publicTables.potions)
    .select("secrets")
    .eq("owner_id", userId)
    .eq("kind", ZOHO_KIND)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: rowToLegacyShape(row), error: null };
}

/**
 * Sanitized status for forge / diagnostics (no secrets exposed).
 * @param {string} userId
 */
export async function getZohoWeaponStatus(userId) {
  const { data, error } = await readZohoSecretsRow(userId);
  if (error) {
    return {
      potionsReadOk: false,
      code: "ZOHO_POTIONS_READ_FAILED",
      message: error.message,
      hasAccessToken: false,
      hasRefreshToken: false,
      hasOrganizationId: false,
      region: null,
      expiresAt: null,
    };
  }
  const d = data;
  return {
    potionsReadOk: true,
    code: d?.access_token ? "ZOHO_ROW_PRESENT" : "ZOHO_NOT_CONNECTED",
    message: d?.access_token ? "potions row has access_token" : "no access_token in potions.secrets",
    hasAccessToken: Boolean(d?.access_token),
    hasRefreshToken: Boolean(d?.refresh_token),
    hasOrganizationId: Boolean(d?.organization_id),
    region: d?.region || null,
    expiresAt: d?.expires_at || null,
  };
}

/**
 * JSON-safe error payload for API routes.
 * @param {unknown} error
 */
export function zohoErrorToJsonPayload(error) {
  if (error && typeof error === "object" && "message" in error) {
    const e = /** @type {{ message?: string, code?: string, links?: unknown }} */ (error);
    const payload = { error: String(e.message ?? error) };
    if (e.code) payload.code = e.code;
    if (e.links) payload.links = e.links;
    return payload;
  }
  return { error: error instanceof Error ? error.message : String(error) };
}
