
export const toc = {
  searchContacts: "Search Opensend contacts and nurture flow state.",
  writeContact: "Create or update an Opensend contact.",
};

import { ensureCdpChrome } from "@/libs/weapon/browserclaw/cdp";
import { chromium } from "playwright-core";

// Opensend uses session-based auth via saved CDP Chrome cookies.
// Public ID (C27C3B82M) and Private ID are tracking pixel credentials, not REST API keys.
// CDP approach decided 2026-04-19. REST API keys can be created at /settings/api-keys if needed.

const API_BASE = "https://bwgkn3md-2.opensend.com";
const APP_URL = "https://app.opensend.com/settings/api-keys";

async function withOpensendPage(fn) {
  await ensureCdpChrome();
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  const captured = {};
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("self/profile") && resp.status() === 200) {
      captured.profile = await resp.json().catch(() => null);
    }
    if (url.includes("/store/") && !url.includes("traffic") && !url.includes("destination") && resp.status() === 200) {
      captured.store = await resp.json().catch(() => null);
    }
  });

  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(4000);

    if (page.url().includes("login")) {
      const emailEl = await page.$('input[name="email"]');
      const passEl = await page.$('input[type="password"]');
      if (!emailEl || !passEl) throw new Error("Opensend login form not found — re-capture auth");
      await emailEl.click(); await page.waitForTimeout(200);
      await passEl.click(); await page.waitForTimeout(1500);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !window.location.href.includes("login"), { timeout: 10000 });
      await page.waitForTimeout(2000);
    }

    return await fn(page, captured);
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function readAccount(input = {}, userId) {
  return withOpensendPage(async (page, captured) => {
    if (captured.profile) return captured.profile;
    throw new Error("Profile data not captured — session may have expired");
  });
}

export async function searchContacts({ query, limit = 50 } = {}, userId) {
  return withOpensendPage(async (page, captured) => {
    const storeData = captured.store?.store;
    if (!storeData) return { ok: false, msg: "Store data not captured" };
    const storeId = storeData.id;

    const cookies = await page.context().cookies(["https://bwgkn3md-2.opensend.com"]);
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set("q", query);
    const resp = await page.request.get(`${API_BASE}/audience/store/${storeId}?${params}`, {
      headers: { Cookie: cookieHeader },
    });
    if (!resp.ok()) return { ok: false, status: resp.status() };
    return resp.json();
  });
}

export async function writeContact({ email, firstName, lastName, tags = [] } = {}, userId) {
  if (!email) throw new Error('"email" is required');
  return withOpensendPage(async (page, captured) => {
    const storeData = captured.store?.store;
    if (!storeData) throw new Error("Store data not captured — cannot write contact");
    const storeId = storeData.id;

    const cookies = await page.context().cookies(["https://bwgkn3md-2.opensend.com"]);
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.post(`${API_BASE}/contact/store/${storeId}`, {
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      data: JSON.stringify({ email, firstName, lastName, tags }),
    });
    if (!resp.ok()) {
      const text = await resp.text();
      throw new Error(`writeContact ${resp.status()}: ${text}`);
    }
    return resp.json();
  });
}

export async function checkCredentials(input = {}, userId) {
  try {
    const result = await readAccount({}, userId);
    const email = result?.user?.email;
    if (email) return { ok: true, msg: `Opensend CDP session active — logged in as ${email}` };
    return { ok: false, msg: "Opensend session check failed" };
  } catch (e) {
    return { ok: false, msg: `Opensend CDP error: ${e.message}` };
  }
}
