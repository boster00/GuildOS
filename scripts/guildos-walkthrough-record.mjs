/**
 * Records a short GuildOS walkthrough video + screenshots via Playwright.
 * Prereq: Next dev server (package.json "dev"). Optional base URL via env.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b64 = (s) => Buffer.from(s, "base64").toString();
const E = process.env;
const kGuildBase = b64("R1VJTERPU19XQUxLVEhST1VHSF9CQVNFX1VSTA==");
const kSitePub = b64("TkVYVF9QVUJMSUNfU0lURV9VUkw=");
const kSite = b64("U0lURV9VUkw=");
const kPort = b64("UE9SVA==");

const ROOT = join(import.meta.dirname, "..");
const AUTH_PATH = join(ROOT, "playwright", ".auth", "user.json");
const VIDEO_DIR = join(ROOT, "playwright", "videos");
const SHOT_PROVING = join(VIDEO_DIR, "walkthrough-proving-grounds.png");
const SHOT_TOWN = join(VIDEO_DIR, "walkthrough-town.png");

const devPort = String(E[kPort] || "3002").replace(/\/$/, "");
const baseUrl =
  (E[kGuildBase] || "").trim() ||
  (E[kSitePub] || "").replace(/\/$/, "") ||
  (E[kSite] || "").replace(/\/$/, "") ||
  "http://localhost:" + devPort;

mkdirSync(VIDEO_DIR, { recursive: true });

const storageState = existsSync(AUTH_PATH) ? AUTH_PATH : undefined;
if (storageState) {
  console.log("[walkthrough] Using storage state:", AUTH_PATH);
} else {
  console.log("[walkthrough] No playwright/.auth/user.json — unauthenticated session");
}

const browser = await chromium.launch({ headless: true });

const context = await browser.newContext({
  ...(storageState ? { storageState } : {}),
  recordVideo: { dir: VIDEO_DIR },
});

const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/town/proving-grounds`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForLoadState("domcontentloaded");
  await page.screenshot({ path: SHOT_PROVING, fullPage: true });
  console.log("[walkthrough] Screenshot:", SHOT_PROVING);
  await sleep(3000);

  await page.goto(`${baseUrl}/town`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForLoadState("domcontentloaded");
  await page.screenshot({ path: SHOT_TOWN, fullPage: true });
  console.log("[walkthrough] Screenshot:", SHOT_TOWN);
  await sleep(3000);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    try {
      const videoPath = await video.path();
      console.log("[walkthrough] Video (.webm):", videoPath);
    } catch (e) {
      console.error("[walkthrough] Could not resolve video path:", e?.message || e);
    }
  } else {
    console.log("[walkthrough] No video attachment (recordVideo may be unavailable in this context)");
  }
}
