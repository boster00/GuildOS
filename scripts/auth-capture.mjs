/**
 * auth-capture.mjs
 *
 * Path 2 (recommended): opens Chrome with a dedicated persistent profile
 * (`launchPersistentContext`). Log in manually, press Enter, and the profile
 * on disk stays authenticated for later runs.
 *
 * Optionally also exports Playwright storageState JSON (Path 1 portable
 * artifact) unless you pass --profile-only.
 *
 * Usage:
 *   node scripts/auth-capture.mjs
 *   node scripts/auth-capture.mjs --profile-only
 *
 * Env:
 *   GUILDOS_PLAYWRIGHT_USER_DATA_DIR — persistent profile folder (default: ~/.guildos-playwright-profile)
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH — Chrome/Chromium path; if unset, uses channel "chrome"
 *   PLAYWRIGHT_STORAGE_STATE_PATH — JSON export path (default: playwright/.auth/user.json)
 *   NEXT_PUBLIC_SITE_URL | GUILDOS_PLAYWRIGHT_START_URL — optional first tab (e.g. http://localhost:3002)
 */

import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import * as readline from "readline";

// ── Config ────────────────────────────────────────────────────────────────────

const profileOnly = process.argv.includes("--profile-only");

const CAPTURE_PROFILE_DIR =
  process.env.GUILDOS_PLAYWRIGHT_USER_DATA_DIR ||
  join(homedir(), ".guildos-playwright-profile");

const STORAGE_STATE_PATH =
  process.env.PLAYWRIGHT_STORAGE_STATE_PATH ||
  join(process.cwd(), "playwright", ".auth", "user.json");

const CHROME_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || null;

const guildStart =
  process.env.GUILDOS_PLAYWRIGHT_START_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "";

const DEFAULT_SITES = [
  { name: "Gmail", url: "https://mail.google.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Cursor", url: "https://www.cursor.com" },
  { name: "Asana", url: "https://app.asana.com" },
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

const context = await chromium.launchPersistentContext(
  CAPTURE_PROFILE_DIR,
  launchOptions(),
);

console.log("\n=== Auth capture (persistent profile) ===");
console.log(`Profile directory:\n  ${CAPTURE_PROFILE_DIR}`);
if (!profileOnly) {
  console.log(`Will also export storageState to:\n  ${STORAGE_STATE_PATH}`);
}
console.log(`Opening ${SITES.length} tabs...\n`);

const pages = await context.pages();
const firstPage = pages[0];

for (let i = 0; i < SITES.length; i++) {
  const { name, url } = SITES[i];
  const page = i === 0 ? firstPage : await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log(`  [${i + 1}] ${name} → ${url}`);
}

console.log("\nLog in to each tab manually.");
console.log(
  "Wait until redirects finish and you clearly see logged-in UI — then press Enter.",
);

await waitForEnter("\n> Press Enter to close and persist profile: ");

if (!profileOnly) {
  const dir = dirname(STORAGE_STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await context.storageState({ path: STORAGE_STATE_PATH });
}

await context.close();

console.log("\n✓ Profile saved on disk (reuse the same GUILDOS_PLAYWRIGHT_USER_DATA_DIR).");
if (!profileOnly) {
  console.log(`✓ storageState exported: ${STORAGE_STATE_PATH}`);
  console.log("  Run  node scripts/auth-load.mjs  to verify with injected cookies.\n");
} else {
  console.log(
    "  Run  node scripts/auth-load.mjs --persistent  to open this profile again.\n",
  );
}
