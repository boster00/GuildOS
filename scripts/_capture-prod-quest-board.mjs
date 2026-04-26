// Capture a screenshot of the prod quest board using Playwright + the
// persistent CIC profile (which holds the session cookie from CIC's prior
// magic-link login). Saves to docs/screenshots/.

import { chromium } from "playwright-core";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const PROFILE = process.env.GUILDOS_CDP_PROFILE_DIR || join(homedir(), ".guildos-cdp-profile");
const OUT_DIR = join(process.cwd(), "docs", "screenshots");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const OUT = join(OUT_DIR, `prod-quest-board-${STAMP}.png`);
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const exe =
  process.env.CHROME_EXECUTABLE_PATH ||
  (process.platform === "win32"
    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    : "/usr/bin/google-chrome");

console.log("Profile:", PROFILE);
console.log("Output:", OUT);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  executablePath: exe,
  viewport: { width: 1600, height: 1100 },
});
const page = await ctx.newPage();
await page.goto("https://guild-os-ten.vercel.app/quest-board", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT, fullPage: false });
console.log("Saved:", OUT);
await ctx.close();
