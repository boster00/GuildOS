/**
 * Browserclaw CDP — connect to the user's running Chrome via DevTools Protocol.
 *
 * Prerequisites: launch Chrome with --remote-debugging-port=9222
 *
 * Usage:
 *   import { executeSteps } from "@/libs/weapon/browserclaw/cdp";
 *   const result = await executeSteps(steps, { cdpUrl: "http://localhost:9222" });
 */

import { chromium } from "playwright-core";

const DEFAULT_CDP_URL = "http://localhost:9222";
const STEP_TIMEOUT = 25_000;

/**
 * Connect to an existing Chrome via CDP and execute a sequence of browser steps.
 *
 * @param {Array<{action: string, [key: string]: unknown}>} steps
 * @param {{ cdpUrl?: string, timeout?: number }} opts
 * @returns {Promise<{ok: boolean, totalElapsed: number, steps: object[]}>}
 */
export async function executeSteps(steps, opts = {}) {
  const cdpUrl = opts.cdpUrl || DEFAULT_CDP_URL;
  const overallStart = Date.now();
  const stepResults = [];

  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (e) {
    return {
      ok: false,
      totalElapsed: Date.now() - overallStart,
      steps: [],
      error: `CDP connect failed (is Chrome running with --remote-debugging-port=9222?): ${e.message}`,
    };
  }

  try {
    // Use the first browser context (the user's default profile)
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    // Use the active page or create one
    const pages = context.pages();
    const page = pages[0] || await context.newPage();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();
      let result;

      try {
        switch (step.action) {
          case "navigate": {
            await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT });
            result = { ok: true, value: step.url };
            break;
          }

          case "wait": {
            const ms = Math.min(30, Math.max(0, Number(step.seconds) || 1)) * 1000;
            await page.waitForTimeout(ms);
            result = { ok: true, value: `waited ${step.seconds}s` };
            break;
          }

          case "typeText": {
            const sel = step.selector || "input";
            await page.waitForSelector(sel, { timeout: 5000 });
            await page.fill(sel, "");
            await page.type(sel, step.text || "", { delay: 30 });
            result = { ok: true, value: step.text };
            break;
          }

          case "click": {
            const sel = step.selector || "button";
            await page.waitForSelector(sel, { timeout: 5000 });
            await page.click(sel);
            result = { ok: true, value: "clicked" };
            break;
          }

          case "pressKey": {
            const key = step.key || "Enter";
            if (step.selector) {
              await page.press(step.selector, key);
            } else {
              await page.keyboard.press(key);
            }
            result = { ok: true, value: `pressed:${key}` };
            break;
          }

          case "obtainText": {
            const sel = step.selector || "body";
            await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});
            const text = await page.$eval(sel, (el) => {
              // For links, return href
              if (el.tagName === "A") return el.href;
              return (el.innerText || el.textContent || "").trim();
            }).catch(() => "");
            result = { ok: true, value: text.slice(0, 2000) };
            break;
          }

          case "obtainHtml": {
            const sel = step.selector || "body";
            await page.waitForSelector(sel, { timeout: 5000 }).catch(() => {});
            const html = await page.$eval(sel, (el) => el.innerHTML).catch(() => "");
            result = { ok: true, value: html.slice(0, 5000) };
            break;
          }

          case "getPageInfo": {
            const title = await page.title();
            const url = page.url();
            result = { ok: true, value: { title, url } };
            break;
          }

          case "evaluate": {
            const val = await page.evaluate(step.expression || "document.title");
            result = { ok: true, value: typeof val === "string" ? val.slice(0, 2000) : val };
            break;
          }

          case "screenshot": {
            const buf = await page.screenshot({ type: "png", fullPage: false });
            result = { ok: true, value: `screenshot:${buf.length} bytes` };
            break;
          }

          default:
            result = { ok: false, error: `Unknown action: ${step.action}` };
        }
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
      });

      if (!result?.ok) break;
    }
  } finally {
    // Just drop the connection — don't close the user's browser.
    // Playwright has no disconnect(); close() on CDP detaches without killing Chrome
    // in modern versions, but we wrap in catch just in case.
    try { await browser.close(); } catch {};
  }

  return {
    ok: stepResults.every((r) => r.ok),
    totalElapsed: Date.now() - overallStart,
    steps: stepResults,
  };
}
