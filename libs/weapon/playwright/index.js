/**
 * Playwright weapon — pure Playwright browser control with persistent auth state.
 *
 * Auth state file: libs/weapon/playwright/user.json (gitignored)
 * To capture auth: import { captureAuth } from "@/libs/weapon/playwright"
 *                  Run directly: node -e "import('@/libs/weapon/playwright').then(m=>m.captureAuth())"
 *
 * Usage:
 *   import { executeSteps } from "@/libs/weapon/playwright";
 *   const result = await executeSteps([{ action: "navigate", url: "https://example.com", item: "nav" }]);
 */

import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

export const STATE_FILE = join(process.cwd(), "libs/weapon/playwright/user.json");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STEP_TIMEOUT = 25_000;

// Service URLs opened during captureAuth — one per weapon that uses a web interface
const SERVICE_URLS = [
  { name: "Gmail",      url: "https://mail.google.com" },
  { name: "Zoho Books", url: "https://books.zoho.com" },
  { name: "Zoho CRM",   url: "https://crm.zoho.com" },
  { name: "Figma",      url: "https://www.figma.com" },
  { name: "Asana",      url: "https://app.asana.com" },
  { name: "Vercel",     url: "https://vercel.com/dashboard" },
  { name: "Cursor",     url: "https://www.cursor.com/settings" },
  { name: "Supabase",   url: "https://supabase.com/dashboard" },
];

const LAUNCH_OPTS = {
  headless: false,
  channel: "chrome",
  args: [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
};

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

export async function readState(statePath = STATE_FILE) {
  try {
    const stats = await stat(statePath);
    const age = Date.now() - stats.mtimeMs;
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content);
    return { state, exists: true, age, expired: age > MAX_AGE_MS, path: statePath };
  } catch {
    return { state: null, exists: false, age: null, expired: true, path: statePath };
  }
}

async function persistState(context, statePath = STATE_FILE) {
  const state = await context.storageState();
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  return statePath;
}

// ---------------------------------------------------------------------------
// Browser init
// ---------------------------------------------------------------------------

/**
 * Launch a browser context with saved auth state if available.
 * Returns { browser, context } — caller must close browser when done.
 */
export async function initBrowser({ statePath = STATE_FILE, headless = false } = {}) {
  const { state } = await readState(statePath);
  const browser = await chromium.launch({ ...LAUNCH_OPTS, headless });
  const ctxOpts = state ? { storageState: state } : {};
  const context = await browser.newContext(ctxOpts);
  return { browser, context };
}

// ---------------------------------------------------------------------------
// Auth capture
// ---------------------------------------------------------------------------

/**
 * Open all service URLs in separate tabs for manual login.
 * Waits for user to press Enter in the terminal, then saves state.
 */
export async function captureAuth({ statePath = STATE_FILE } = {}) {
  console.log("\n[playwright/captureAuth] Launching browser...");

  const browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext();

  for (let i = 0; i < SERVICE_URLS.length; i++) {
    const { name, url } = SERVICE_URLS[i];
    const page = i === 0 ? await context.newPage() : await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    console.log(`  [${i + 1}/${SERVICE_URLS.length}] Opened ${name}: ${url}`);
  }

  console.log("\n>>> Log in to all services in the browser tabs above.");
  console.log(">>> Press Enter here when done to save state...\n");

  // Wait for Enter key
  await new Promise((resolve) => {
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });

  const saved = await persistState(context, statePath);
  const { state } = await readState(saved);
  const cookieCount = Array.isArray(state?.cookies) ? state.cookies.length : 0;
  console.log(`\n[playwright/captureAuth] Saved ${cookieCount} cookies → ${saved}`);

  await browser.close();
  return { ok: true, statePath: saved, cookieCount };
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

/**
 * Execute browser steps using saved auth state.
 * Creates a fresh context per call (stateless across calls, auth loaded from file).
 *
 * @param {Array<{action: string, item: string, [key: string]: unknown}>} steps
 * @param {{ statePath?: string, headless?: boolean, newPage?: boolean }} opts
 */
export async function executeSteps(steps, opts = {}) {
  const statePath = opts.statePath || STATE_FILE;
  const overallStart = Date.now();
  const stepResults = [];

  const { browser, context } = await initBrowser({ statePath, headless: opts.headless ?? true });
  const page = await context.newPage();

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();
      let result;
      try {
        result = await executeOneStep(page, step);
      } catch (e) {
        result = { ok: false, error: e.message };
      }
      stepResults.push({
        index: i,
        action: step.action,
        elapsed: Date.now() - stepStart,
        ok: result?.ok ?? false,
        value: result?.value ?? null,
        error: result?.error ?? null,
        ...(step.item ? { item: step.item } : {}),
      });
      if (!result?.ok) break;
    }
  } finally {
    await browser.close();
  }

  return {
    ok: stepResults.every((r) => r.ok),
    totalElapsed: Date.now() - overallStart,
    steps: stepResults,
  };
}

async function executeOneStep(page, step) {
  const timeout = Math.min(STEP_TIMEOUT, Number(step.timeout) || STEP_TIMEOUT);

  switch (step.action) {
    case "navigate":
      await page.goto(step.url, { waitUntil: "domcontentloaded", timeout });
      return { ok: true, value: step.url };

    case "wait": {
      const ms = Math.min(30, Math.max(0, Number(step.seconds) || 1)) * 1000;
      await page.waitForTimeout(ms);
      if (step.selector) {
        await page.waitForSelector(step.selector, { timeout: 30_000 }).catch(() => {});
      }
      return { ok: true, value: `waited ${step.seconds}s` };
    }

    case "typeText": {
      const sel = step.selector || "input";
      await page.waitForSelector(sel, { timeout: 5000 });
      if (step.clearContent !== false) await page.fill(sel, "");
      await page.type(sel, step.text || "", { delay: 30 });
      return { ok: true, value: step.text };
    }

    case "click": {
      const sel = step.selector || "button";
      await page.waitForSelector(sel, { timeout: 5000 });
      await page.click(sel);
      return { ok: true, value: "clicked" };
    }

    case "pressKey": {
      const key = step.key || "Enter";
      if (step.selector) await page.press(step.selector, key);
      else await page.keyboard.press(key);
      return { ok: true, value: `pressed:${key}` };
    }

    case "get":
    case "obtainText": {
      const sel = step.selector || "body";
      await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});
      if (step.getAll) {
        const values = await page.$$eval(sel, (els, attr) =>
          els.map((el) => attr && attr !== "innerText" ? el.getAttribute(attr) || "" : (el.innerText || el.textContent || "").trim()),
          step.attribute || null,
        ).catch(() => []);
        return { ok: true, value: values };
      }
      const attr = step.attribute;
      if (attr && !["innerText", "textContent"].includes(attr)) {
        if (attr === "innerHTML") { const h = await page.$eval(sel, (el) => el.innerHTML).catch(() => ""); return { ok: true, value: h.slice(0, 5000) }; }
        if (attr === "outerHTML") { const h = await page.$eval(sel, (el) => el.outerHTML).catch(() => ""); return { ok: true, value: h.slice(0, 5000) }; }
        if (attr === "value") { const v = await page.$eval(sel, (el) => el.value || "").catch(() => ""); return { ok: true, value: v.slice(0, 2000) }; }
        const v = await page.$eval(sel, (el, a) => el.getAttribute(a) || "", attr).catch(() => ""); return { ok: true, value: v.slice(0, 2000) };
      }
      const text = await page.$eval(sel, (el) => el.tagName === "A" ? el.href : (el.innerText || el.textContent || "").trim()).catch(() => "");
      return { ok: true, value: text.slice(0, 2000) };
    }

    case "obtainHtml": {
      const sel = step.selector || "body";
      await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});
      const html = await page.$eval(sel, (el) => el.innerHTML).catch(() => "");
      return { ok: true, value: html.slice(0, 5000) };
    }

    case "getUrl":
      return { ok: true, value: page.url() };

    case "getPageInfo": {
      const title = await page.title();
      return { ok: true, value: { title, url: page.url() } };
    }

    case "evaluate": {
      const val = await page.evaluate(step.expression || "document.title");
      return { ok: true, value: typeof val === "string" ? val.slice(0, 2000) : val };
    }

    case "screenshot": {
      const buf = await page.screenshot({ type: "png", fullPage: step.fullPage === true, path: step.path || undefined });
      return { ok: true, value: step.path ? `screenshot saved: ${step.path}` : `screenshot:${buf.length} bytes`, ...(step.path ? {} : { buffer: buf }) };
    }

    case "saveState": {
      await page.context().storageState({ path: step.path || STATE_FILE });
      return { ok: true, value: `state saved: ${step.path || STATE_FILE}` };
    }

    default:
      return { ok: false, error: `Unknown action: ${step.action}` };
  }
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  const { exists, expired, age, state } = await readState();
  if (!exists) return { ok: false, msg: "No auth state — run captureAuth() to log in and save state." };
  if (expired) return { ok: false, msg: `Auth state expired (${Math.round(age / 3600000)}h old). Re-run captureAuth().` };
  const cookieCount = Array.isArray(state?.cookies) ? state.cookies.length : 0;
  const domains = [...new Set((state?.cookies || []).map((c) => c.domain?.replace(/^\./, "")).filter(Boolean))];
  return { ok: true, msg: `Auth state valid — ${cookieCount} cookies across ${domains.length} domains`, domains };
}
