/**
 * Browserclaw CDP — connect to Chrome via DevTools Protocol with auto-launch
 * and reconnect support.
 *
 * Prerequisites: Chrome installed at system path or LOCALAPPDATA.
 *
 * Usage:
 *   import { executeSteps, ensureCdpChrome } from "@/libs/weapon/browserclaw/cdp";
 *   await ensureCdpChrome();  // launches CDP Chrome if not running
 *   const result = await executeSteps(steps, { cdpUrl: "http://localhost:9222" });
 */

import { chromium } from "playwright-core";
import { execFile } from "node:child_process";

const DEFAULT_CDP_URL = "http://localhost:9222";
const STEP_TIMEOUT = 25_000;
const CDP_CONNECT_TIMEOUT = 10_000;
const MAX_CONNECT_RETRIES = 2;

// ---------------------------------------------------------------------------
// Chrome lifecycle
// ---------------------------------------------------------------------------

/**
 * Check if a CDP Chrome is reachable.
 * @param {string} [cdpUrl]
 * @returns {Promise<boolean>}
 */
export async function isCdpRunning(cdpUrl = DEFAULT_CDP_URL) {
  try {
    const res = await fetch(`${cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Launch a Chrome instance with CDP enabled using a SEPARATE profile dir.
 * Never touches the user's main Chrome profile.
 * @param {{ port?: number, headless?: boolean }} opts
 * @returns {Promise<{ ok: boolean, msg: string }>}
 */
export async function ensureCdpChrome({ port = 9222, headless = false } = {}) {
  const cdpUrl = `http://localhost:${port}`;
  if (await isCdpRunning(cdpUrl)) {
    return { ok: true, msg: `CDP Chrome already running on port ${port}` };
  }

  // Resolve Chrome path (Windows)
  const localAppData = process.env.LOCALAPPDATA || "";
  const chromePaths = [
    `${localAppData}/Google/Chrome/Application/chrome.exe`,
    `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
  ];

  let chromePath = null;
  const { access } = await import("node:fs/promises");
  for (const p of chromePaths) {
    try {
      await access(p);
      chromePath = p;
      break;
    } catch { /* not found */ }
  }

  if (!chromePath) {
    return { ok: false, msg: "Chrome not found. Install Chrome or set chrome path manually." };
  }

  const cdpProfileDir = `${localAppData}/Google/Chrome/CDP_Profile`;
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${cdpProfileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
  ];
  if (headless) args.push("--headless=new");

  // Launch detached — don't wait for Chrome to exit
  const child = execFile(chromePath, args, { detached: true, stdio: "ignore" });
  child.unref();

  // Wait for CDP to become available
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    if (await isCdpRunning(cdpUrl)) {
      return { ok: true, msg: `CDP Chrome launched on port ${port}` };
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return { ok: false, msg: `Chrome launched but CDP not responding on port ${port} after 10s` };
}

// ---------------------------------------------------------------------------
// Connection with retry
// ---------------------------------------------------------------------------

/**
 * Connect to CDP with retry logic.
 * @param {string} cdpUrl
 * @param {number} retries
 */
async function connectWithRetry(cdpUrl, retries = MAX_CONNECT_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl, {
        timeout: CDP_CONNECT_TIMEOUT,
      });
      return browser;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        // Try to launch Chrome if first attempt fails
        if (attempt === 0) {
          const port = parseInt(new URL(cdpUrl).port || "9222", 10);
          await ensureCdpChrome({ port });
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw new Error(
    `CDP connect failed after ${retries + 1} attempts (is Chrome running with --remote-debugging-port?): ${lastError?.message}`,
  );
}

// ---------------------------------------------------------------------------
// Page management
// ---------------------------------------------------------------------------

/**
 * Get a usable page from the browser context.
 * Creates a new page if none exist, reuses existing if available.
 * @param {import("playwright-core").Browser} browser
 * @param {{ newPage?: boolean }} opts
 */
async function getPage(browser, { newPage = false } = {}) {
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  if (newPage) return context.newPage();
  const pages = context.pages();
  // Pick first non-blank page, or first page, or create new
  const page = pages.find((p) => !p.url().startsWith("chrome://")) || pages[0] || (await context.newPage());
  return page;
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

/**
 * Connect to Chrome via CDP and execute a sequence of browser steps.
 * Auto-launches Chrome if not running. Retries connection on failure.
 *
 * @param {Array<{action: string, [key: string]: unknown}>} steps
 * @param {{ cdpUrl?: string, timeout?: number, newPage?: boolean, storageState?: string }} opts
 * @returns {Promise<{ok: boolean, totalElapsed: number, steps: object[]}>}
 */
export async function executeSteps(steps, opts = {}) {
  const cdpUrl = opts.cdpUrl || DEFAULT_CDP_URL;
  const overallStart = Date.now();
  const stepResults = [];

  let browser;
  try {
    browser = await connectWithRetry(cdpUrl);
  } catch (e) {
    return {
      ok: false,
      totalElapsed: Date.now() - overallStart,
      steps: [],
      error: e.message,
    };
  }

  try {
    let page;

    // If storageState is provided, create a new context with it
    if (opts.storageState) {
      const context = await browser.newContext({ storageState: opts.storageState });
      page = await context.newPage();
    } else {
      page = await getPage(browser, { newPage: opts.newPage });
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();
      let result;

      try {
        result = await executeOneStep(page, step);
      } catch (e) {
        result = { ok: false, error: e.message };
      }

      const elapsed = Date.now() - stepStart;
      stepResults.push({
        index: i,
        action: step.action,
        elapsed,
        ok: result?.ok ?? false,
        value: result?.value ?? null,
        error: result?.error ?? null,
        ...(step.item ? { item: step.item } : {}),
      });

      if (!result?.ok) break;
    }
  } finally {
    // Drop the CDP connection without closing the user's browser
    try {
      browser.close();
    } catch { /* ignore */ }
  }

  return {
    ok: stepResults.every((r) => r.ok),
    totalElapsed: Date.now() - overallStart,
    steps: stepResults,
  };
}

/**
 * Execute a single step. Separated for clarity and error isolation.
 * @param {import("playwright-core").Page} page
 * @param {{ action: string, [key: string]: unknown }} step
 */
async function executeOneStep(page, step) {
  const timeout = Math.min(STEP_TIMEOUT, Number(step.timeout) || STEP_TIMEOUT);

  switch (step.action) {
    case "navigate": {
      await page.goto(step.url, { waitUntil: "domcontentloaded", timeout });
      return { ok: true, value: step.url };
    }

    case "wait": {
      const ms = Math.min(30, Math.max(0, Number(step.seconds) || 1)) * 1000;
      await page.waitForTimeout(ms);
      // If selector specified, also wait for it
      if (step.selector) {
        try {
          await page.waitForSelector(step.selector, { timeout: 30_000 });
          return { ok: true, value: `waited ${step.seconds}s + selector appeared` };
        } catch {
          return { ok: true, value: `waited ${step.seconds}s, selector not found (non-fatal)` };
        }
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
      if (step.selector) {
        await page.press(step.selector, key);
      } else {
        await page.keyboard.press(key);
      }
      return { ok: true, value: `pressed:${key}` };
    }

    case "get":
    case "obtainText": {
      const sel = step.selector || "body";
      await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});

      if (step.getAll) {
        const values = await page.$$eval(sel, (els, attr) =>
          els.map((el) => {
            if (attr && attr !== "innerText") return el.getAttribute(attr) || "";
            return (el.innerText || el.textContent || "").trim();
          }),
          step.attribute || null,
        ).catch(() => []);
        return { ok: true, value: values };
      }

      const attr = step.attribute;
      if (attr && attr !== "innerText" && attr !== "textContent") {
        if (attr === "innerHTML") {
          const html = await page.$eval(sel, (el) => el.innerHTML).catch(() => "");
          return { ok: true, value: html.slice(0, 5000) };
        }
        if (attr === "outerHTML") {
          const html = await page.$eval(sel, (el) => el.outerHTML).catch(() => "");
          return { ok: true, value: html.slice(0, 5000) };
        }
        if (attr === "value") {
          const val = await page.$eval(sel, (el) => el.value || "").catch(() => "");
          return { ok: true, value: val.slice(0, 2000) };
        }
        const attrVal = await page.$eval(sel, (el, a) => el.getAttribute(a) || "", attr).catch(() => "");
        return { ok: true, value: attrVal.slice(0, 2000) };
      }

      const text = await page.$eval(sel, (el) => {
        if (el.tagName === "A") return el.href;
        return (el.innerText || el.textContent || "").trim();
      }).catch(() => "");
      return { ok: true, value: text.slice(0, 2000) };
    }

    case "obtainHtml": {
      const sel = step.selector || "body";
      await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});
      const html = await page.$eval(sel, (el) => el.innerHTML).catch(() => "");
      return { ok: true, value: html.slice(0, 5000) };
    }

    case "getUrl": {
      return { ok: true, value: page.url() };
    }

    case "getPageInfo": {
      const title = await page.title();
      const url = page.url();
      return { ok: true, value: { title, url } };
    }

    case "evaluate": {
      const val = await page.evaluate(step.expression || "document.title");
      return { ok: true, value: typeof val === "string" ? val.slice(0, 2000) : val };
    }

    case "screenshot": {
      const buf = await page.screenshot({
        type: "png",
        fullPage: step.fullPage === true,
        path: step.path || undefined,
      });
      return {
        ok: true,
        value: step.path
          ? `screenshot saved: ${step.path}`
          : `screenshot:${buf.length} bytes`,
        ...(step.path ? {} : { buffer: buf }),
      };
    }

    default:
      return { ok: false, error: `Unknown action: ${step.action}` };
  }
}

// ---------------------------------------------------------------------------
// Credential / status check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  const running = await isCdpRunning();
  if (running) {
    return { ok: true, msg: "CDP Chrome is running on port 9222" };
  }
  return {
    ok: false,
    msg: "CDP Chrome not running. Call ensureCdpChrome() to auto-launch, or start manually with --remote-debugging-port=9222.",
  };
}
