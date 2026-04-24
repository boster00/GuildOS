/**
 * Cloudflare weapon — unified read/search connector for Cloudflare zones.
 *
 * Auth: CLOUDFLARE_API_TOKEN from profiles.env_vars or process.env.
 *
 * Hides always-on plumbing: pagination for DNS, GraphQL scalar nuances
 * (Date=YYYY-MM-DD vs Time=RFC3339), the 1-day window cap on adaptive
 * analytics datasets (Pro), and the sunset legacy REST `/analytics/dashboard`
 * endpoint (GraphQL-only on new zones).
 */

import { database } from "@/libs/council/database";

export const toc = {
  read: "Read a Cloudflare resource by name (zone, zones, dns, firewallRules, accessRules, pageRules, rateLimits, zoneSettings, rulesets, ruleset, botManagement, tokenCapabilities). Input: {resource, zoneName?|zoneId?, rulesetId?}. Resolves zone by name when only zoneName is given.",
  search: "Run a GraphQL analytics query. Datasets: requestsDaily (7d), cacheByHost (24h), cacheByPath (24h), cacheByContentType (24h), firewallEvents (24h — hard cap), bypassedPaths (24h). Input: {resource, zoneName?|zoneId?, limit?, windowHours?}.",
  normalize: "Interpret ambiguous Cloudflare semantics. Kinds: legacyFirewallAction (translates bypass/skip to actual behavior), httpResponse (classifies a fetched response as allow/challenge/block/origin-error using CSP+body tells).",
};

const API = "https://api.cloudflare.com/client/v4";
const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getToken(userId) {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const db = await database.init("service");
  if (userId) {
    const { data } = await db.from("profiles").select("env_vars").eq("id", userId).maybeSingle();
    const t = data?.env_vars?.CLOUDFLARE_API_TOKEN;
    if (t) return t;
  }
  // Fallback: any profile carrying the token (convenience for inline CLI use).
  const { data } = await db.from("profiles").select("id,env_vars");
  for (const p of data || []) {
    const t = p.env_vars?.CLOUDFLARE_API_TOKEN;
    if (t) return t;
  }
  return null;
}

async function cfFetch(path, opts = {}, userId) {
  const token = await getToken(userId);
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  const url = path.startsWith("http") ? path : API + path;
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = { raw: body }; }
  return { status: res.status, ok: res.ok, json };
}

async function cfGraphQL(query, variables, userId) {
  const token = await getToken(userId);
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Cloudflare GraphQL error: ${JSON.stringify(json.errors).slice(0, 400)}`);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Zone resolution
// ---------------------------------------------------------------------------

async function resolveZoneId({ zoneId, zoneName }, userId) {
  if (zoneId) return zoneId;
  if (!zoneName) throw new Error("resolveZone: provide zoneId or zoneName");
  const { json } = await cfFetch(`/zones?name=${encodeURIComponent(zoneName)}`, {}, userId);
  if (!json.success || !json.result?.[0]) {
    throw new Error(`Zone "${zoneName}" not found or token lacks access`);
  }
  return json.result[0].id;
}

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

/**
 * @param {{resource: string, zoneId?: string, zoneName?: string, rulesetId?: string}} input
 * @param {string} [userId]
 */
export async function read(input = {}, userId) {
  const { resource, rulesetId } = input;
  if (!resource) throw new Error("read: resource required");

  if (resource === "zones") {
    const { json } = await cfFetch("/zones?per_page=50", {}, userId);
    return { zones: json.result || [] };
  }

  if (resource === "tokenCapabilities") {
    return readTokenCapabilities(input, userId);
  }

  // All other resources need a zone.
  const zoneId = await resolveZoneId(input, userId);

  if (resource === "zone") {
    const { json } = await cfFetch(`/zones/${zoneId}`, {}, userId);
    return { zone: json.result || null };
  }

  if (resource === "dns") {
    const all = [];
    let page = 1;
    while (true) {
      const { json } = await cfFetch(`/zones/${zoneId}/dns_records?per_page=200&page=${page}`, {}, userId);
      if (!json.result?.length) break;
      all.push(...json.result);
      const total = json.result_info?.total_pages || 1;
      if (page >= total) break;
      page++;
    }
    return { records: all };
  }

  if (resource === "firewallRules") {
    const { json } = await cfFetch(`/zones/${zoneId}/firewall/rules?per_page=100`, {}, userId);
    return { rules: json.result || [] };
  }

  if (resource === "accessRules") {
    const { json } = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules?per_page=200`, {}, userId);
    return { rules: json.result || [] };
  }

  if (resource === "pageRules") {
    const { json } = await cfFetch(`/zones/${zoneId}/pagerules`, {}, userId);
    return { rules: json.result || [] };
  }

  if (resource === "rateLimits") {
    const { json } = await cfFetch(`/zones/${zoneId}/rate_limits`, {}, userId);
    return { rules: json.result || [] };
  }

  if (resource === "zoneSettings") {
    const { status, json } = await cfFetch(`/zones/${zoneId}/settings`, {}, userId);
    if (status === 403) throw new Error("Token lacks Zone Settings:Read");
    const flat = {};
    for (const s of json.result || []) flat[s.id] = { value: s.value, editable: s.editable, modified_on: s.modified_on };
    return { settings: flat };
  }

  if (resource === "rulesets") {
    const { status, json } = await cfFetch(`/zones/${zoneId}/rulesets`, {}, userId);
    if (status === 403) throw new Error("Token lacks Zone WAF:Read");
    return { rulesets: json.result || [] };
  }

  if (resource === "ruleset") {
    if (!rulesetId) throw new Error("read ruleset requires rulesetId");
    const { status, json } = await cfFetch(`/zones/${zoneId}/rulesets/${rulesetId}`, {}, userId);
    if (status === 403) throw new Error("Token lacks Zone WAF:Read");
    return { ruleset: json.result || null };
  }

  if (resource === "botManagement") {
    const { status, json } = await cfFetch(`/zones/${zoneId}/bot_management`, {}, userId);
    if (status === 403) throw new Error("Token lacks Account Bot Management:Read");
    return { botManagement: json.result || null };
  }

  throw new Error(`read: unknown resource "${resource}"`);
}

async function readTokenCapabilities({ zoneName, zoneId }, userId) {
  const token = await getToken(userId);
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  // Verify token first
  const verifyRes = await fetch(API + "/user/tokens/verify", { headers: { Authorization: `Bearer ${token}` } });
  const verify = await verifyRes.json();
  if (!verify.success) return { valid: false, verify, capabilities: {} };

  let zid = zoneId;
  if (!zid && zoneName) {
    try { zid = await resolveZoneId({ zoneName }, userId); } catch { /* leave null */ }
  }
  const endpoints = zid ? [
    ["zone", `/zones/${zid}`],
    ["dns", `/zones/${zid}/dns_records?per_page=1`],
    ["firewallRules", `/zones/${zid}/firewall/rules?per_page=1`],
    ["accessRules", `/zones/${zid}/firewall/access_rules/rules?per_page=1`],
    ["pageRules", `/zones/${zid}/pagerules`],
    ["rateLimits", `/zones/${zid}/rate_limits`],
    ["zoneSettings", `/zones/${zid}/settings`],
    ["rulesets", `/zones/${zid}/rulesets`],
    ["botManagement", `/zones/${zid}/bot_management`],
  ] : [];
  const capabilities = {};
  for (const [name, p] of endpoints) {
    const r = await fetch(API + p, { headers: { Authorization: `Bearer ${token}` } });
    capabilities[name] = { status: r.status, ok: r.ok };
  }
  return { valid: true, tokenId: verify.result?.id, zoneId: zid || null, capabilities };
}

// ---------------------------------------------------------------------------
// search (GraphQL analytics)
// ---------------------------------------------------------------------------

const fmtDate = (d) => d.toISOString().slice(0, 10);

/**
 * @param {{resource: string, zoneId?: string, zoneName?: string, limit?: number, windowHours?: number}} input
 * @param {string} [userId]
 */
export async function search(input = {}, userId) {
  const { resource, limit = 50, windowHours = 24 } = input;
  if (!resource) throw new Error("search: resource required");
  const zoneId = await resolveZoneId(input, userId);
  const now = new Date();
  const startWindow = new Date(now.getTime() - windowHours * 3600 * 1000);

  if (resource === "requestsDaily") {
    // 7-day daily rollup. Uses Date scalar (YYYY-MM-DD).
    const s = new Date(now.getTime() - 7 * 86400 * 1000);
    const q = `query($z:String!,$s:Date!,$e:Date!){viewer{zones(filter:{zoneTag:$z}){
      httpRequests1dGroups(limit:7,filter:{date_geq:$s,date_leq:$e},orderBy:[date_ASC]){
        dimensions{date}
        sum{requests cachedRequests bytes cachedBytes threats}
        uniq{uniques}
      }
    }}}`;
    const d = await cfGraphQL(q, { z: zoneId, s: fmtDate(s), e: fmtDate(now) }, userId);
    return { daily: d.viewer.zones[0]?.httpRequests1dGroups || [] };
  }

  if (resource === "cacheByHost") {
    const q = `query($z:String!,$d1:Time!,$d2:Time!,$n:Int!){viewer{zones(filter:{zoneTag:$z}){
      httpRequestsAdaptiveGroups(limit:$n,filter:{datetime_geq:$d1,datetime_leq:$d2},orderBy:[count_DESC]){
        count dimensions{cacheStatus clientRequestHTTPHost edgeResponseContentTypeName}
        sum{edgeResponseBytes}
      }
    }}}`;
    const d = await cfGraphQL(q, { z: zoneId, d1: startWindow.toISOString(), d2: now.toISOString(), n: limit }, userId);
    return { rows: d.viewer.zones[0]?.httpRequestsAdaptiveGroups || [] };
  }

  if (resource === "cacheByContentType") {
    const q = `query($z:String!,$d1:Time!,$d2:Time!,$n:Int!){viewer{zones(filter:{zoneTag:$z}){
      httpRequestsAdaptiveGroups(limit:$n,filter:{datetime_geq:$d1,datetime_leq:$d2},orderBy:[count_DESC]){
        count dimensions{cacheStatus edgeResponseContentTypeName}
        sum{edgeResponseBytes}
      }
    }}}`;
    const d = await cfGraphQL(q, { z: zoneId, d1: startWindow.toISOString(), d2: now.toISOString(), n: limit }, userId);
    return { rows: d.viewer.zones[0]?.httpRequestsAdaptiveGroups || [] };
  }

  if (resource === "cacheByPath" || resource === "bypassedPaths") {
    const cacheFilter = resource === "bypassedPaths" ? `,cacheStatus_in:["bypass","none","dynamic","miss"]` : "";
    const q = `query($z:String!,$d1:Time!,$d2:Time!,$n:Int!){viewer{zones(filter:{zoneTag:$z}){
      httpRequestsAdaptiveGroups(limit:$n,filter:{datetime_geq:$d1,datetime_leq:$d2${cacheFilter}},orderBy:[count_DESC]){
        count dimensions{cacheStatus edgeResponseContentTypeName clientRequestPath clientRequestHTTPHost}
        sum{edgeResponseBytes}
      }
    }}}`;
    const d = await cfGraphQL(q, { z: zoneId, d1: startWindow.toISOString(), d2: now.toISOString(), n: limit }, userId);
    return { rows: d.viewer.zones[0]?.httpRequestsAdaptiveGroups || [] };
  }

  if (resource === "firewallEvents") {
    // HARD CAP: adaptive firewall dataset rejects windows > 1 day on Pro.
    const clamp = Math.min(windowHours, 24);
    const d1 = new Date(now.getTime() - clamp * 3600 * 1000);
    const q = `query($z:String!,$d1:Time!,$d2:Time!,$n:Int!){viewer{zones(filter:{zoneTag:$z}){
      firewallEventsAdaptiveGroups(limit:$n,filter:{datetime_geq:$d1,datetime_leq:$d2},orderBy:[count_DESC]){
        count dimensions{action source ruleId clientRequestHTTPHost clientCountryName}
      }
    }}}`;
    const d = await cfGraphQL(q, { z: zoneId, d1: d1.toISOString(), d2: now.toISOString(), n: limit }, userId);
    return { events: d.viewer.zones[0]?.firewallEventsAdaptiveGroups || [], windowClampedToHours: clamp };
  }

  throw new Error(`search: unknown resource "${resource}"`);
}

// ---------------------------------------------------------------------------
// normalize (pure interpretation — no network)
// ---------------------------------------------------------------------------

/**
 * @param {{kind: string, data: unknown}} input
 */
export function normalize({ kind, data } = {}) {
  if (kind === "legacyFirewallAction") {
    // Legacy Firewall Rules action semantics differ from the plain-English names:
    // - "bypass": SKIP Cloudflare security features for matching requests (WAF, Bot Fight, Security Level, Rate Limiting by ID).
    //   NOT a block. A rule labeled "[Blacklist] … action=bypass" is inverted from intent.
    // - "skip": Skip specific downstream products (specified in `products`). Same family as bypass but scoped.
    // - "allow": Allow matching requests through all security products (same end state as bypass for matching traffic, but semantically different in audit trail).
    // - "challenge" / "managed_challenge" / "js_challenge": Interactive challenge.
    // - "block": Drop the request.
    // - "log": Log only, no enforcement.
    const a = String(data || "").toLowerCase();
    const meaning = {
      bypass: "SKIP all WAF/Bot/Security-Level checks for matching traffic (whitelist). NOT a block.",
      skip: "Skip the downstream products specified in the rule (see `products`). Whitelist-ish.",
      allow: "Allow through; bypasses Managed Challenges. Whitelist.",
      challenge: "Interactive CAPTCHA challenge.",
      managed_challenge: "Cloudflare Managed Challenge (JS + non-interactive for humans, fails bots).",
      js_challenge: "JS challenge (deprecated for Managed).",
      block: "Drop the request. Enforcement.",
      log: "Log only. No enforcement.",
    };
    return { action: a, meaning: meaning[a] || `Unknown action "${a}"` };
  }

  if (kind === "httpResponse") {
    // Classify a response object: { status, headers, body }.
    const r = /** @type {{status: number, headers: Record<string,string>, body?: string}} */ (data || {});
    const status = r.status;
    const headers = r.headers || {};
    const body = r.body || "";
    const csp = (headers["content-security-policy"] || headers["Content-Security-Policy"] || "").toLowerCase();
    const server = (headers.server || headers.Server || "").toLowerCase();
    const cfCache = headers["cf-cache-status"] || headers["CF-Cache-Status"] || null;
    const cfMitigated = headers["cf-mitigated"] || headers["CF-Mitigated"] || null;

    // Managed Challenge tell: 403 + CSP referencing challenges.cloudflare.com.
    if (status === 403 && csp.includes("challenges.cloudflare.com")) {
      return { classification: "challenge", reason: "Managed Challenge page (CSP references challenges.cloudflare.com)", cfCache, cfMitigated };
    }
    // cf-mitigated header is the authoritative signal when present.
    if (cfMitigated) {
      return { classification: cfMitigated === "challenge" ? "challenge" : "block", reason: `cf-mitigated=${cfMitigated}`, cfCache, cfMitigated };
    }
    // Cloudflare 1xxx error pages are edge-origin errors, not blocks.
    if (status >= 500 && /cloudflare/.test(body) && /Error code \d{3,4}/i.test(body)) {
      return { classification: "origin-error", reason: "Cloudflare error page (origin unreachable)", cfCache, cfMitigated };
    }
    if (status === 403 && server === "cloudflare") {
      return { classification: "block", reason: "HTTP 403 from Cloudflare edge (likely WAF or firewall block)", cfCache, cfMitigated };
    }
    if (status >= 200 && status < 400) {
      return { classification: "allow", reason: `HTTP ${status}`, cfCache, cfMitigated };
    }
    return { classification: "other", reason: `HTTP ${status}`, cfCache, cfMitigated };
  }

  throw new Error(`normalize: unknown kind "${kind}"`);
}

// ---------------------------------------------------------------------------
// Credential health — used by the WEAPONS registry.
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    const token = await getToken(userId);
    if (!token) return { ok: false, msg: "No CLOUDFLARE_API_TOKEN in env or profiles" };
    const r = await fetch(API + "/user/tokens/verify", { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!j.success) return { ok: false, msg: `Token invalid: ${JSON.stringify(j.errors).slice(0, 120)}` };
    return { ok: true, msg: `Token ${j.result?.id?.slice(0, 8)}… active` };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }
}
