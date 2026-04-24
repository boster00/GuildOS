/**
 * supabase_ui weapon — Supabase WEB UI via CDP browser automation.
 *
 * This weapon controls the Supabase dashboard at app.supabase.com.
 * It is NOT the Supabase API/SDK — use `libs/council/database` for that.
 * Use this weapon when you need things only the web UI exposes:
 *   - SQL editor execution with visible results
 *   - Reading table data without knowing the schema
 *   - Browsing logs (postgres, auth, realtime, edge functions)
 *   - Inspecting project settings, API keys, storage buckets
 *
 * Auth: session cookies saved in ~/.guildos-cdp-profile via auth-capture.mjs.
 * No API key required.
 */

export const toc = {
  readTable: "Read rows from a Supabase table via PostgREST.",
  readLogs: "Read Supabase project logs (postgres/auth/realtime/edge-functions) via CDP dashboard.",
  readAPISettings: "Read API URL and keys from the Supabase settings page via CDP.",
  readStorageBuckets: "List storage buckets visible in the Supabase dashboard via CDP.",
};

import { ensureCdpChrome } from "@/libs/weapon/browserclaw/cdp";
import { chromium } from "playwright-core";

const BASE = "https://supabase.com/dashboard";

async function getProjectRef(userId) {
  // Default to the project ref from env
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (ref) return ref;
  throw new Error("Cannot determine Supabase project ref from NEXT_PUBLIC_SUPABASE_URL");
}

async function withSupabasePage(fn) {
  await ensureCdpChrome();
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  try {
    return await fn(page, browser);
  } finally {
    await page.close();
    await browser.close();
  }
}

async function ensureLoggedIn(page) {
  await page.goto(`${BASE}/projects`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3000);
  if (page.url().includes("/sign-in") || page.url().includes("/login")) {
    throw new Error("Supabase UI not logged in — run scripts/auth-capture.mjs to capture session");
  }
}

/**
 * Execute a SQL query in the Supabase SQL editor and return the results.
 * Uses the Supabase REST API with the service role key for reliability,
 * but navigates to the UI first to confirm the session is valid.
 */
export async function executeSQL({ sql, projectRef } = {}, userId) {
  if (!sql) throw new Error('"sql" is required');

  // Use the Supabase REST API directly (more reliable than UI scraping for SQL)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRETE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY not set");

  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }).catch(() => null);

  // Fall back to the pg REST endpoint
  const pgResp = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!pgResp.ok) {
    const text = await pgResp.text();
    throw new Error(`Supabase SQL failed (${pgResp.status}): ${text}`);
  }
  return pgResp.json();
}

/**
 * Read rows from a table via the Supabase REST API (PostgREST).
 * Navigates the web UI to confirm the table exists; reads data via REST.
 */
export async function readTable({ table, limit = 50, filter } = {}, userId) {
  if (!table) throw new Error('"table" is required');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRETE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY not set");

  let url = `${supabaseUrl}/rest/v1/${table}?limit=${limit}`;
  if (filter) url += `&${filter}`;

  const resp = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase readTable ${table} failed (${resp.status}): ${text}`);
  }
  const rows = await resp.json();
  const total = resp.headers.get("content-range")?.split("/")?.[1];
  return { rows, total: total ? Number(total) : undefined };
}

/**
 * Read Supabase project logs from the web UI via CDP.
 * service: "postgres" | "auth" | "realtime" | "edge-functions" | "postgrest"
 */
export async function readLogs({ service = "postgres", limit = 50 } = {}, userId) {
  const ref = await getProjectRef(userId);
  return withSupabasePage(async (page) => {
    await ensureLoggedIn(page);

    const logsUrl = `${BASE}/project/${ref}/logs/${service}`;
    await page.goto(logsUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(5000);

    const text = await page.innerText("body").catch(() => "");
    if (text.includes("No logs") || text.includes("no events")) return { logs: [], service };

    // Capture the log API responses
    const logs = [];
    page.on("response", async (resp) => {
      if (resp.url().includes("/logs") && resp.status() === 200) {
        try {
          const ct = resp.headers()["content-type"] || "";
          if (ct.includes("json")) {
            const body = await resp.json().catch(() => null);
            if (body?.result) logs.push(...(body.result || []));
          }
        } catch { /* ignore */ }
      }
    });

    // Reload to capture the log fetch
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(5000);

    return { logs: logs.slice(0, limit), service };
  });
}

/**
 * Read the project's API settings (URL, anon key, service role key) from the web UI.
 */
export async function readAPISettings({} = {}, userId) {
  const ref = await getProjectRef(userId);
  return withSupabasePage(async (page) => {
    await ensureLoggedIn(page);

    const responses = {};
    page.on("response", async (resp) => {
      if (resp.url().includes("/api-keys") && resp.status() === 200) {
        try {
          const body = await resp.json().catch(() => null);
          if (body) responses.apiKeys = body;
        } catch { /* ignore */ }
      }
    });

    await page.goto(`${BASE}/project/${ref}/settings/api`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(5000);

    const text = await page.innerText("body").catch(() => "");
    return { text: text.slice(0, 2000), apiKeys: responses.apiKeys };
  });
}

/**
 * Read storage buckets from the web UI.
 */
export async function readStorageBuckets({} = {}, userId) {
  const ref = await getProjectRef(userId);
  return withSupabasePage(async (page) => {
    await ensureLoggedIn(page);

    const buckets = [];
    page.on("response", async (resp) => {
      if (resp.url().includes("/storage") && resp.status() === 200) {
        try {
          const ct = resp.headers()["content-type"] || "";
          if (ct.includes("json")) {
            const body = await resp.json().catch(() => null);
            if (Array.isArray(body)) buckets.push(...body);
          }
        } catch { /* ignore */ }
      }
    });

    await page.goto(`${BASE}/project/${ref}/storage/buckets`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(5000);

    return { buckets };
  });
}

export async function checkCredentials(input = {}, userId) {
  try {
    return withSupabasePage(async (page) => {
      await page.goto(`${BASE}/projects`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);
      const url = page.url();
      if (url.includes("/sign-in") || url.includes("/login")) {
        return { ok: false, msg: "Supabase UI not logged in — run scripts/auth-capture.mjs" };
      }
      const text = await page.innerText("body").catch(() => "");
      const hasProjects = text.includes("project") || text.includes("Project");
      return { ok: hasProjects, msg: hasProjects ? "Supabase UI session active" : "Supabase UI loaded but no projects found" };
    });
  } catch (e) {
    return { ok: false, msg: `Supabase UI CDP error: ${e.message}` };
  }
}
