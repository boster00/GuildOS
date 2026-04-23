/**
 * Browserclaw CDP weapon — headless scraper infrastructure.
 *
 * Use cases (NOT for agent-driven browsing):
 *  - Server-side headless scrapers that run deterministically: `libs/weapon/linkedin`,
 *    `libs/weapon/pubcompare`. These are weapons in the strict sense — no agent in
 *    the loop, scripted selectors, batch execution.
 *  - Not for local Claude's interactive browsing (use Claude-in-Chrome MCP instead).
 *  - Not reachable from cloud Cursor agents (port 9222 is local-only).
 *
 * Architecture: Chrome persistent profile at `~/.guildos-cdp-profile` on port 9222.
 * `ensureCdpChrome()` spawns Chrome if not already running; `executeSteps(steps)` drives it.
 * Auth cookies from `playwright/.auth/user.json` are injected on fresh launch.
 */

import { chromium } from "playwright-core";
import { exec } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, existsSync } from "node:fs";

export const CDP_PORT = 9222;
export const CDP_URL = `http://localhost:${CDP_PORT}`;
export const CDP_PROFILE_DIR =
  process.env.GUILDOS_CDP_PROFILE_DIR ||
  join(homedir(), ".guildos-cdp-profile");
export const AUTH_STATE_PATH =
  process.env.GUILDOS_AUTH_STATE_PATH ||
  join(process.cwd(), "playwright/.auth/user.json");

const STEP_TIMEOUT = 25_000;

// ---------------------------------------------------------------------------
// Chrome launch helpers
// ---------------------------------------------------------------------------

function getChromeExe() {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  if (process.platform === "win32") {
    return `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/local/bin/google-chrome";
}

/**
 * Returns true if CDP Chrome is reachable on port 9222.
 */
export async function isCdpRunning() {
  try {
    const resp = await fetch(`${CDP_URL}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Inject cookies from playwright/.auth/user.json into the running CDP session.
 * Silently skips if the file doesn't exist.
 */
async function _injectAuthState(authPath = AUTH_STATE_PATH) {
  if (!existsSync(authPath)) return;
  try {
    const { cookies } = JSON.parse(readFileSync(authPath, "utf8"));
    if (!cookies?.length) return;
    const browser = await chromium.connectOverCDP(CDP_URL);
    const ctx = browser.contexts()[0] ?? await browser.newContext();
    await ctx.addCookies(cookies);
    await browser.close();
  } catch {
    // non-fatal — profile cookies may still be valid
  }
}

/**
 * Launch Chrome on port 9222 with the dedicated CDP profile if not already running.
 * No-op if CDP is already reachable. Returns { launched, msg }.
 */
export async function ensureCdpChrome({ profileDir = CDP_PROFILE_DIR } = {}) {
  if (await isCdpRunning()) {
    return { launched: false, msg: "CDP Chrome already running on port 9222" };
  }

  const exe = getChromeExe();
  const flags = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir="${profileDir}"`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
  ].join(" ");

  if (process.platform === "win32") {
    exec(`start "" "${exe}" ${flags}`);
  } else {
    exec(`"${exe}" ${flags} &`);
  }

  // Poll up to 5 seconds for CDP to become reachable
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isCdpRunning()) {
      await _injectAuthState();
      return { launched: true, msg: `CDP Chrome launched on port ${CDP_PORT}` };
    }
  }

  throw new Error(`Chrome launched but CDP not reachable on port ${CDP_PORT} after 5s. Check that Chrome is installed at: ${exe}`);
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

/**
 * Execute browser steps by connecting to the existing CDP Chrome on port 9222.
 * Does NOT close Chrome — it remains running for subsequent calls.
 *
 * @param {Array<{action: string, item: string, [key: string]: unknown}>} steps
 * @param {{ storageState?: string }} opts
 */
export async function executeSteps(steps, opts = {}) {
  const overallStart = Date.now();
  const stepResults = [];

  const browser = await chromium.connectOverCDP(CDP_URL);

  // Reuse the first existing context (the default CDP context), or create one
  const existingContexts = browser.contexts();
  const context = existingContexts.length > 0
    ? existingContexts[0]
    : await browser.newContext(opts.storageState ? { storageState: opts.storageState } : {});

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
        ...(result?.buffer ? { buffer: result.buffer } : {}),
      });
      if (!result?.ok) break;
    }
  } finally {
    await page.close().catch(() => {});
    // browser.close() disconnects the Playwright client — Chrome keeps running
    await browser.close().catch(() => {});
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
        const values = await page.$$eval(
          sel,
          (els, attr) => els.map((el) =>
            attr && attr !== "innerText"
              ? el.getAttribute(attr) || ""
              : (el.innerText || el.textContent || "").trim()
          ),
          step.attribute || null,
        ).catch(() => []);
        return { ok: true, value: values };
      }
      const attr = step.attribute;
      if (attr && !["innerText", "textContent"].includes(attr)) {
        if (attr === "innerHTML") {
          const h = await page.$eval(sel, (el) => el.innerHTML).catch(() => "");
          return { ok: true, value: h.slice(0, 5000) };
        }
        if (attr === "outerHTML") {
          const h = await page.$eval(sel, (el) => el.outerHTML).catch(() => "");
          return { ok: true, value: h.slice(0, 5000) };
        }
        if (attr === "value") {
          const v = await page.$eval(sel, (el) => el.value || "").catch(() => "");
          return { ok: true, value: v.slice(0, 2000) };
        }
        const v = await page.$eval(sel, (el, a) => el.getAttribute(a) || "", attr).catch(() => "");
        return { ok: true, value: v.slice(0, 2000) };
      }
      const text = await page.$eval(
        sel,
        (el) => el.tagName === "A" ? el.href : (el.innerText || el.textContent || "").trim(),
      ).catch(() => "");
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
      const buf = await page.screenshot({
        type: "png",
        fullPage: step.fullPage === true,
        path: step.path || undefined,
      });
      return {
        ok: true,
        value: step.path ? `screenshot saved: ${step.path}` : `screenshot:${buf.length} bytes`,
        ...(step.path ? {} : { buffer: buf }),
      };
    }

    default:
      return { ok: false, error: `Unknown action: ${step.action}` };
  }
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  const running = await isCdpRunning();
  if (!running) {
    return {
      ok: false,
      msg: `CDP Chrome not running on port ${CDP_PORT}. Call ensureCdpChrome() or launch Chrome with --remote-debugging-port=${CDP_PORT} --user-data-dir="${CDP_PROFILE_DIR}"`,
    };
  }
  try {
    const resp = await fetch(`${CDP_URL}/json/version`);
    const info = await resp.json();
    return { ok: true, msg: `CDP Chrome reachable: ${info.Browser || "Chrome"} on port ${CDP_PORT}` };
  } catch (e) {
    return { ok: false, msg: `CDP reachable but version check failed: ${e.message}` };
  }
}
