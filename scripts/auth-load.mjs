/**
 * auth-load.mjs
 *
 * Two modes:
 *
 * 1) Default — Path 1 / hybrid: fresh browser + storageState JSON (portable).
 * 2) --persistent — Path 2: same user data directory as auth-capture.mjs (no JSON needed).
 *
 * Usage:
 *   node scripts/auth-load.mjs
 *   node scripts/auth-load.mjs path/to/state.json
 *   node scripts/auth-load.mjs --persistent
 *
 * Env (match auth-capture.mjs):
 *   GUILDOS_PLAYWRIGHT_USER_DATA_DIR
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
 *   PLAYWRIGHT_STORAGE_STATE_PATH — default playwright/.auth/user.json
 */

import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const usePersistent = process.argv.includes("--persistent");
const positional = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const stateArg = positional[0] || null;

const CAPTURE_PROFILE_DIR =
  process.env.GUILDOS_PLAYWRIGHT_USER_DATA_DIR ||
  join(homedir(), ".guildos-playwright-profile");

const DEFAULT_STATE_FILE =
  process.env.PLAYWRIGHT_STORAGE_STATE_PATH ||
  join(process.cwd(), "playwright", ".auth", "user.json");

const CHROME_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || null;

const guildStart =
  process.env.GUILDOS_PLAYWRIGHT_START_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "";

const DEFAULT_VERIFY = [
  { name: "Gmail", url: "https://mail.google.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Cursor", url: "https://www.cursor.com" },
  { name: "Asana", url: "https://app.asana.com" },
];

const VERIFY_SITES = guildStart
  ? [{ name: "GuildOS", url: guildStart }, ...DEFAULT_VERIFY]
  : DEFAULT_VERIFY;

function launchOptions() {
  const base = {
    headless: false,
    viewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",  // hides webdriver flag → Google allows sign-in
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  if (CHROME_EXECUTABLE) {
    return { ...base, executablePath: CHROME_EXECUTABLE };
  }
  return { ...base, channel: "chrome" };
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (usePersistent) {
  console.log("\n=== Auth load (persistent profile) ===");
  console.log(`Profile: ${CAPTURE_PROFILE_DIR}\n`);

  const context = await chromium.launchPersistentContext(CAPTURE_PROFILE_DIR, launchOptions());

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
  console.error("  Run  node scripts/auth-capture.mjs  first (without --profile-only), or:");
  console.error("  node scripts/auth-load.mjs --persistent\n");
  process.exit(1);
}

const state = JSON.parse(readFileSync(stateFile, "utf8"));
const cookieOrigins = [...new Set(state.cookies?.map((c) => c.domain) ?? [])];
console.log(`\n=== Auth load (storageState) ===`);
console.log(`State file: ${stateFile}`);
console.log(`Cookies from: ${cookieOrigins.length} domains`);
console.log(`Origins with storage: ${state.origins?.length ?? 0}\n`);

const browser = await chromium.launch(launchOptions());

const context = await browser.newContext({
  storageState: stateFile,
  viewport: null,
});

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
