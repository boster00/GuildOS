/**
 * auth-load.mjs
 *
 * Verify saved auth state by opening Chrome and navigating to key services.
 *
 * Two modes:
 * 1) Default — fresh browser + storageState JSON (portable, for verifying the JSON export)
 * 2) --persistent — same CDP profile dir as auth-capture.mjs (verifies the profile directly)
 *
 * Usage:
 *   node scripts/auth-load.mjs
 *   node scripts/auth-load.mjs path/to/state.json
 *   node scripts/auth-load.mjs --persistent
 *
 * Env (match auth-capture.mjs):
 *   GUILDOS_CDP_PROFILE_DIR      — CDP profile folder (default: ~/.guildos-cdp-profile)
 *   CHROME_EXECUTABLE_PATH       — Chrome binary (auto-detected if unset)
 *   PLAYWRIGHT_STORAGE_STATE_PATH — JSON export path (default: playwright/.auth/user.json)
 */

import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const usePersistent = process.argv.includes("--persistent");
const positional = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const stateArg = positional[0] || null;

const CDP_PROFILE_DIR =
  process.env.GUILDOS_CDP_PROFILE_DIR ||
  join(homedir(), ".guildos-cdp-profile");

const DEFAULT_STATE_FILE =
  process.env.PLAYWRIGHT_STORAGE_STATE_PATH ||
  join(process.cwd(), "playwright", ".auth", "user.json");

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

const guildStart =
  process.env.GUILDOS_PLAYWRIGHT_START_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "";

const DEFAULT_VERIFY = [
  { name: "Gmail",  url: "https://mail.google.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Cursor", url: "https://www.cursor.com" },
  { name: "Asana",  url: "https://app.asana.com" },
];

const VERIFY_SITES = guildStart
  ? [{ name: "GuildOS", url: guildStart }, ...DEFAULT_VERIFY]
  : DEFAULT_VERIFY;

function launchOptions() {
  return {
    headless: false,
    viewport: null,
    executablePath: getChromeExe(),
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (usePersistent) {
  console.log("\n=== Auth load (CDP profile) ===");
  console.log(`Profile: ${CDP_PROFILE_DIR}\n`);

  const context = await chromium.launchPersistentContext(CDP_PROFILE_DIR, launchOptions());
  const pages = await context.pages();
  const firstPage = pages[0];

  for (let i = 0; i < VERIFY_SITES.length; i++) {
    const { name, url } = VERIFY_SITES[i];
    const page = i === 0 ? firstPage : await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    console.log(`  [${i + 1}] ${name} → ${url}`);
  }

  console.log("\nBrowser is open. Close the window when done — script exits.\n");
  await context.waitForEvent("close").catch(() => {});
  process.exit(0);
}

const stateFile = stateArg ? resolve(stateArg) : resolve(DEFAULT_STATE_FILE);

if (!existsSync(stateFile)) {
  console.error(`\n✗ State file not found: ${stateFile}`);
  console.error("  Run  node scripts/auth-capture.mjs  first, or:");
  console.error("  node scripts/auth-load.mjs --persistent\n");
  process.exit(1);
}

const state = JSON.parse(readFileSync(stateFile, "utf8"));
const cookieOrigins = [...new Set(state.cookies?.map((c) => c.domain) ?? [])];
console.log(`\n=== Auth load (storageState JSON) ===`);
console.log(`State file: ${stateFile}`);
console.log(`Cookies from: ${cookieOrigins.length} domains`);
console.log(`Origins with storage: ${state.origins?.length ?? 0}\n`);

const browser = await chromium.launch(launchOptions());
const context = await browser.newContext({ storageState: stateFile, viewport: null });

console.log(`Opening ${VERIFY_SITES.length} tabs to verify...\n`);
const firstPage = await context.newPage();

for (let i = 0; i < VERIFY_SITES.length; i++) {
  const { name, url } = VERIFY_SITES[i];
  const page = i === 0 ? firstPage : await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log(`  [${i + 1}] ${name} → ${url}`);
}

console.log("\nBrowser is open. Close it when done — this script will exit.\n");
await context.waitForEvent("close").catch(() => {});
await browser.close().catch(() => {});
