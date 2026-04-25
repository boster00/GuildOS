// Re-capture the 3 evidence screenshots for quest a8c0ba6f via Playwright
// using the existing playwright/.auth/user.json storage state. Outputs to
// docs/screenshots/monthly-monitors-smoke-2026-04-25/.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT_DIR = resolve("docs/screenshots/monthly-monitors-smoke-2026-04-25");
const AUTH = resolve("playwright/.auth/user.json");

const FOLDER_URL = "https://drive.google.com/drive/folders/1IDEpsNglG9TPiZpDsagUI6FFRbgWag-G";
const REPORT_URL = "https://drive.google.com/file/d/17aMBE_5njzrbHGj8YiQ_hXeXzwuLL4qW/view";

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: AUTH,
    viewport: { width: 1568, height: 920 },
  });
  const page = await ctx.newPage();

  // 01: 2026-03 folder listing
  await page.goto(FOLDER_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);
  const folderPath = `${OUT_DIR}/01-monthly-reports-2026-03-folder.png`;
  await page.screenshot({ path: folderPath, fullPage: false });
  console.log("WROTE", folderPath);

  // 03: Distributor report cover (page 1)
  await page.goto(REPORT_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(4000);
  const coverPath = `${OUT_DIR}/03-distributor-report-page1.png`;
  await page.screenshot({ path: coverPath, fullPage: false });
  console.log("WROTE", coverPath);

  // 02: scroll down to page 5 (charts + narrative)
  // Each slide ~700px tall in 100% zoom; ~4 scrolls of 700px gets to page 5.
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
  }
  const page5Path = `${OUT_DIR}/02-distributor-report-page5.png`;
  await page.screenshot({ path: page5Path, fullPage: false });
  console.log("WROTE", page5Path);

  await browser.close();
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
