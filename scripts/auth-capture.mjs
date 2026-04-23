/**
 * auth-capture.mjs
 *
 * Logs in to key services using a persistent Chrome profile, then exports
 * a storageState JSON for agents that can't use CDP directly.
 *
 * The persistent profile written here is the SAME directory that ensureCdpChrome()
 * in libs/weapon/browserclaw/cdp.js uses when launching Chrome on port 9222.
 * This means after running this script, CDP Chrome starts already logged in.
 *
 * Usage:
 *   node scripts/auth-capture.mjs
 *   node scripts/auth-capture.mjs --profile-only   (skip JSON export)
 *
 * Env:
 *   GUILDOS_CDP_PROFILE_DIR — CDP profile folder (default: ~/.guildos-cdp-profile)
 *   CHROME_EXECUTABLE_PATH  — Chrome binary path (auto-detected by platform if unset)
 *   PLAYWRIGHT_STORAGE_STATE_PATH — JSON export path (default: playwright/.auth/user.json)
 *   NEXT_PUBLIC_SITE_URL | GUILDOS_PLAYWRIGHT_START_URL — optional first tab
 */

import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import * as readline from "readline";

// ── Config ────────────────────────────────────────────────────────────────────

const profileOnly = process.argv.includes("--profile-only");

// Must match CDP_PROFILE_DIR in libs/weapon/browserclaw/cdp.js
const CDP_PROFILE_DIR =
  process.env.GUILDOS_CDP_PROFILE_DIR ||
  join(homedir(), ".guildos-cdp-profile");

const STORAGE_STATE_PATH =
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

const DEFAULT_SITES = [
  { name: "Gmail",  url: "https://mail.google.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Cursor", url: "https://www.cursor.com" },
  { name: "Asana",  url: "https://app.asana.com" },
];

const SITES = guildStart
  ? [{ name: "GuildOS", url: guildStart }, ...DEFAULT_SITES]
  : DEFAULT_SITES;

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

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

console.log("\n=== Auth capture (CDP profile) ===");
console.log(`Profile directory:\n  ${CDP_PROFILE_DIR}`);
console.log(`(This is the same profile used by ensureCdpChrome / CDP Chrome on port 9222)`);
if (!profileOnly) {
  console.log(`\nWill also export storageState to:\n  ${STORAGE_STATE_PATH}`);
}
console.log(`\nOpening ${SITES.length} tabs...\n`);

const context = await chromium.launchPersistentContext(CDP_PROFILE_DIR, launchOptions());

const pages = await context.pages();
const firstPage = pages[0];

for (let i = 0; i < SITES.length; i++) {
  const { name, url } = SITES[i];
  const page = i === 0 ? firstPage : await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log(`  [${i + 1}] ${name} → ${url}`);
}

console.log("\nLog in to each tab manually.");
console.log("Wait until redirects finish and you clearly see logged-in UI — then press Enter.");

await waitForEnter("\n> Press Enter to save and close: ");

if (!profileOnly) {
  const dir = dirname(STORAGE_STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await context.storageState({ path: STORAGE_STATE_PATH });
}

await context.close();

console.log("\n✓ CDP profile saved — ensureCdpChrome() will now start Chrome already logged in.");
if (!profileOnly) {
  console.log(`✓ storageState exported: ${STORAGE_STATE_PATH}`);
  console.log("  Run  node scripts/auth-load.mjs  to verify.\n");
}
