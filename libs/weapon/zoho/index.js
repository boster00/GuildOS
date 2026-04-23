/**
 * Zoho weapon — single module covering Zoho Books, Zoho CRM, and Zoho Mail (shared OAuth).
 * Public API: searchBooks (Books), searchCrm (CRM), readMailAccounts, readMailMessages, readWeaponStatus, readOrganizationId (OAuth setup only).
 *
 * Token acquisition (readAccessToken) is internal plumbing — agents never decide when to refresh a token.
 * Auth: User identity resolves via adventurer execution context first, then Next.js requireUser.
 * This lets the weapon work in both execution context (cron/scripts) and HTTP handlers.
 */
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

const ZOHO_MAIL_BASE = {
  com: "https://mail.zoho.com",
  eu: "https://mail.zoho.eu",
  in: "https://mail.zoho.in",
  com_au: "https://mail.zoho.com.au",
  jp: "https://mail.zoho.jp",
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

/**
 * Resolve userId: adventurer execution context → Next.js requireUser → explicit arg.
 * @param {string | null | undefined} [explicit]
 */
async function resolveUserId(explicit) {
  if (explicit) return explicit;
  const { getAdventurerExecutionUserId } = await import("@/libs/adventurer/advance.js");
  const ctxId = getAdventurerExecutionUserId();
  if (ctxId) return ctxId;
  const { requireUser } = await import("@/libs/council/auth/server");
  const user = await requireUser();
  return user.id;
}

/**
 * Get a DB client: prefer service-role from execution context (works outside Next.js HTTP),
 * fall back to server-scoped client.
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} [injected]
 */
async function resolveClient(injected) {
  if (injected) return injected;
  const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
  const ctx = getAdventurerExecutionContext();
  if (ctx?.client) return ctx.client;
  return database.init("service");
}

async function getZohoConnection(userId, injectedClient) {
  const db = await resolveClient(injectedClient);
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

export async function upsertZohoConnection(payload, injectedClient) {
  const db = await resolveClient(injectedClient);
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

/** Short, Forge-centric message used in all "not connected / expired" errors. */
function getAuthLinksMessage() {
  const L = getAuthLinks();
  return `Go to the Forge to activate or re-forge the Zoho weapon: ${L.forgeZoho}`;
}

/** Message specifically for missing / insufficient CRM scope (401 from CRM API). */
function getCrmScopeMessage() {
  const L = getAuthLinks();
  return (
    `WEAPON_REAUTH_REQUIRED: The Zoho weapon does not have CRM scope (received 401 from Zoho CRM API). ` +
    `This means the current OAuth token was issued before CRM permissions were added. ` +
    `Go to the Forge, click "Scrap weapon & forge again", then re-authorize to grant CRM access: ${L.forgeZoho}`
  );
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

async function refreshAndPersist(userId, current, injectedClient) {
  const { clientId, clientSecret } = await getZohoBooksAppCredentials(userId);
  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing Zoho OAuth app credentials (ZOHO_BOOKS_CLIENT_ID / ZOHO_BOOKS_CLIENT_SECRET). ` +
      `Set them in Council Hall → Formulary, then ${getAuthLinksMessage()}`
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
    throw new Error(
      `Zoho token refresh failed (${refreshed.error}). ${getAuthLinksMessage()}`
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
  const { error: upErr } = await upsertZohoConnection({ user_id: userId, ...newSecrets }, injectedClient);
  if (upErr) {
    throw new Error(`Could not save refreshed token: ${upErr.message}`);
  }
  return newSecrets;
}

/**
 * @param {string} userId
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} [injectedClient]
 * @returns {Promise<{ access_token: string, region: string, organization_id: string | null, refresh_token: string | null }>}
 */
async function ensureSecretsForCurrentUser(userId, injectedClient) {
  let current = await getZohoConnection(userId, injectedClient);

  if (!current?.access_token && !current?.refresh_token) {
    throw new Error(`Zoho weapon not connected. ${getAuthLinksMessage()}`);
  }

  const needsRefresh = !current.access_token || accessTokenLikelyExpired(current.expires_at);

  if (needsRefresh) {
    if (!current.refresh_token) {
      throw new Error(`Zoho access token expired and no refresh token found. ${getAuthLinksMessage()}`);
    }
    current = await refreshAndPersist(userId, current, injectedClient);
  }

  if (!current?.access_token) {
    throw new Error(`Zoho access token unavailable after refresh. ${getAuthLinksMessage()}`);
  }

  return {
    access_token: current.access_token,
    region: current.region || "com",
    organization_id: current.organization_id ?? null,
    refresh_token: current.refresh_token ?? null,
  };
}

/**
 * Exchange an OAuth authorization code for tokens.
 * @param {{ code: string, region: string, clientId: string, clientSecret: string, redirectUri: string }} p
 */
export async function exchangeZohoCode({ code, region, clientId, clientSecret, redirectUri }) {
  const host = TOKEN_HOST[region] || TOKEN_HOST.com;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
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

/**
 * Fetch the Zoho Books organization_id using a fresh access token.
 * @param {string} accessToken
 * @param {string} [region]
 */
export async function readOrganizationId(accessToken, region = "com") {
  const baseUrl = ZOHO_API_BASE[region] || ZOHO_API_BASE.com;
  const response = await fetch(`${baseUrl}/books/v3/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json = await response.json();
  const orgs = json?.organizations;
  return Array.isArray(orgs) && orgs[0]?.organization_id ? String(orgs[0].organization_id) : null;
}

/**
 * @param {string} [userId] — optional; resolves from execution context or requireUser if omitted
 * @returns {Promise<string>} Bearer access token for Zoho API.
 */
async function readAccessToken(userId) {
  const uid = await resolveUserId(userId);
  const s = await ensureSecretsForCurrentUser(uid);
  return s.access_token;
}

/**
 * Search any Zoho Books module (salesorders, invoices, bills, etc.).
 * Returns up to `limit` records sorted by date descending.
 *
 * @param {string} module — API path segment (e.g. "salesorders", "invoices")
 * @param {number} limit
 * @param {string} [userId] — optional; resolves from execution context if omitted
 * @returns {Promise<unknown[]>}
 */
export async function searchBooks(module, limit, userId) {
  const uid = await resolveUserId(userId);
  const secrets = await ensureSecretsForCurrentUser(uid);
  const region = secrets.region || "com";
  const baseUrl = ZOHO_API_BASE[region] || ZOHO_API_BASE.com;
  const organizationId = secrets.organization_id;

  if (!organizationId) {
    throw new Error(
      `Zoho organization_id is missing. Re-forge the weapon so the callback can store it. ${getAuthLinksMessage()}`
    );
  }

  const mod = String(module ?? "").replace(/^\//, "").replace(/\/$/, "");
  if (!mod) {
    throw new Error("searchBooks: module is required.");
  }

  const n = Math.max(1, Math.min(200, Number(limit) || 10));

  const url = new URL(`${baseUrl}/books/v3/${encodeURIComponent(mod)}`);
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[Zoho:searchBooks] ${url.toString()}`);
  }
  url.searchParams.set("organization_id", organizationId);
  url.searchParams.set("per_page", String(n));
  url.searchParams.set("sort_column", "date");
  url.searchParams.set("sort_order", "D");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${secrets.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZOHO_BOOKS_FETCH_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  const json = await response.json();
  if (json && typeof json === "object") {
    const arrKey = Object.keys(json).find((k) => Array.isArray(json[k]));
    if (arrKey && Array.isArray(json[arrKey])) {
      return json[arrKey].slice(0, n);
    }
  }
  return [];
}

/**
 * Default fields to request per CRM module. Keeps responses concise and
 * avoids returning hundreds of custom fields. Unknown modules omit the
 * `fields` param and let the CRM API return its default set.
 */
const CRM_MODULE_FIELDS = {
  Contacts: "First_Name,Last_Name,Email,Phone,Account_Name,Lead_Source",
  Quotes: "Subject,Quote_Stage,Grand_Total,Account_Name,Contact_Name,Expiry_Date",
  Leads: "First_Name,Last_Name,Email,Phone,Company,Lead_Source",
  Deals: "Deal_Name,Stage,Amount,Account_Name,Closing_Date",
};

/**
 * Search any Zoho CRM module (Contacts, Quotes, Leads, Deals, …).
 * Uses `GET /crm/v7/{Module}`. Module names are PascalCase.
 *
 * @param {string} module — PascalCase CRM module name (e.g. "Contacts", "Quotes")
 * @param {number} limit — max records to return (default 5, max 200)
 * @param {string} [userId] — optional; resolves from execution context if omitted
 * @returns {Promise<unknown[]>}
 */
export async function searchCrm(module, limit, userId) {
  const uid = await resolveUserId(userId);
  const secrets = await ensureSecretsForCurrentUser(uid);
  const region = secrets.region || "com";
  const baseUrl = ZOHO_API_BASE[region] || ZOHO_API_BASE.com;
  const n = Math.max(1, Math.min(200, Number(limit) || 5));

  const mod = String(module ?? "").trim();
  if (!mod) {
    throw new Error("searchCrm: module is required.");
  }

  const url = new URL(`${baseUrl}/crm/v7/${encodeURIComponent(mod)}`);
  url.searchParams.set("per_page", String(n));
  const fields = CRM_MODULE_FIELDS[mod];
  if (fields) {
    url.searchParams.set("fields", fields);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${secrets.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(getCrmScopeMessage());
    }
    throw new Error(`ZOHO_CRM_FETCH_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  const json = await response.json();
  return Array.isArray(json?.data) ? json.data.slice(0, n) : [];
}

/**
 * Build the Zoho OAuth authorization URL.
 * Scopes cover both Zoho Books and Zoho CRM (shared OAuth flow).
 *
 * @param {{ region?: string, clientId: string, redirectUri: string, extraScopes?: string[] }} opts
 */
export function buildZohoOAuthAuthorizeUrl({ region = "com", clientId, redirectUri, extraScopes = [] }) {
  const host = TOKEN_HOST[region] || TOKEN_HOST.com;
  const defaultScopes = [
    "ZohoBooks.fullaccess.all",
    "ZohoCRM.modules.contacts.READ",
    "ZohoCRM.modules.contacts.WRITE",
    "ZohoCRM.modules.quotes.READ",
    "ZohoCRM.modules.leads.READ",
    "ZohoCRM.modules.deals.READ",
    "ZohoMail.messages.ALL",
    "ZohoMail.accounts.READ",
  ];
  const scopes = [...new Set([...defaultScopes, ...extraScopes])].join(",");
  const url = new URL(`${host}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

/** OAuth callback URL registered with Zoho (must match console + token exchange). */
export function getZohoOAuthCallbackUrl() {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/api/weapon/zoho?action=callback`;
}

/**
 * Delete the Zoho OAuth token row for a user (scrap the weapon).
 * The Formulary OAuth app credentials (clientId/clientSecret) are untouched.
 * @param {string} userId
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} [injectedClient]
 */
export async function deleteZohoConnection(userId, injectedClient) {
  const db = await resolveClient(injectedClient);
  return db
    .from(publicTables.potions)
    .delete()
    .eq("owner_id", userId)
    .eq("kind", ZOHO_KIND);
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
export async function readWeaponStatus(userId) {
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

function getMailScopeMessage() {
  const L = getAuthLinks();
  return (
    `WEAPON_REAUTH_REQUIRED: The Zoho weapon does not have Mail scope (received 401 from Zoho Mail API). ` +
    `Go to the Forge, click "Scrap weapon & forge again", then re-authorize to grant Mail access: ${L.forgeZoho}`
  );
}

/**
 * List Zoho Mail accounts for the authenticated user.
 * Returns account IDs needed for reading messages.
 *
 * @param {string} [userId]
 * @returns {Promise<Array<{ accountId: string, emailAddress: string, displayName: string }>>}
 */
export async function readMailAccounts(userId) {
  const uid = await resolveUserId(userId);
  const secrets = await ensureSecretsForCurrentUser(uid);
  const region = secrets.region || "com";
  const baseUrl = ZOHO_MAIL_BASE[region] || ZOHO_MAIL_BASE.com;

  const response = await fetch(`${baseUrl}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${secrets.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(getMailScopeMessage());
    }
    throw new Error(`ZOHO_MAIL_ACCOUNTS_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  const json = await response.json();
  const accounts = Array.isArray(json?.data) ? json.data : [];
  return accounts.map((a) => ({
    accountId: String(a.accountId ?? a.account_id ?? ""),
    emailAddress: a.emailAddress ?? a.incomingUserName ?? "",
    displayName: a.displayName ?? a.name ?? "",
  }));
}

/**
 * List Zoho Mail messages for a specific account.
 * Defaults to the authenticated user's primary inbox.
 *
 * @param {string} accountId — from readMailAccounts()
 * @param {{ limit?: number, folder?: string }} [opts]
 * @param {string} [userId]
 * @returns {Promise<Array<{ messageId: string, subject: string, fromAddress: string, receivedTime: string, summary: string }>>}
 */
export async function readMailMessages(accountId, opts = {}, userId) {
  const uid = await resolveUserId(userId);
  const secrets = await ensureSecretsForCurrentUser(uid);
  const region = secrets.region || "com";
  const baseUrl = ZOHO_MAIL_BASE[region] || ZOHO_MAIL_BASE.com;
  const limit = Math.max(1, Math.min(200, Number(opts.limit) || 5));

  const url = new URL(`${baseUrl}/api/accounts/${accountId}/messages/view`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sortorder", "false"); // newest first

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${secrets.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(getMailScopeMessage());
    }
    throw new Error(`ZOHO_MAIL_MESSAGES_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  const json = await response.json();
  const messages = Array.isArray(json?.data) ? json.data : [];
  return messages.slice(0, limit).map((m) => ({
    messageId: String(m.messageId ?? ""),
    subject: m.subject ?? "(no subject)",
    fromAddress: m.fromAddress ?? "",
    receivedTime: m.receivedTime ?? "",
    summary: m.summary ?? "",
  }));
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
