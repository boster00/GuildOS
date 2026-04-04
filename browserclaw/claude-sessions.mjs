import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_STATE_PATH = resolve(__dirname, '.claude-auth-state.json');

async function getOrCreateAuthState() {
  if (existsSync(AUTH_STATE_PATH)) {
    console.log('Using saved auth state from:', AUTH_STATE_PATH);
    return AUTH_STATE_PATH;
  }

  console.log('No saved auth state found. Opening browser for login...');
  console.log('You have 120 seconds to log in. The browser will close automatically after that.');

  // Use the system Chrome to avoid Google blocking Playwright's bundled Chromium
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',  // Use installed Chrome instead of Playwright Chromium
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');

  // Wait for the user to complete login - poll for a sign we're logged in
  const startTime = Date.now();
  const timeoutMs = 120000;
  while (Date.now() - startTime < timeoutMs) {
    const url = page.url();
    // If we've landed on the code page (not a login/auth page), we're likely logged in
    if (url.includes('claude.ai/code') && !url.includes('login') && !url.includes('auth') && !url.includes('accounts.google')) {
      // Check if the page has meaningful content (not just a redirect)
      const content = await page.evaluate(() => document.body?.innerText?.length || 0);
      if (content > 100) {
        console.log('Login appears complete. Waiting 3 more seconds...');
        await page.waitForTimeout(3000);
        break;
      }
    }
    await page.waitForTimeout(2000);
    console.log(`Waiting for login... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
  }

  // Save the auth state
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log('Auth state saved to:', AUTH_STATE_PATH);
  await browser.close();
  return AUTH_STATE_PATH;
}

async function scrapeCloudSessions() {
  const authStatePath = await getOrCreateAuthState();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authStatePath });
  const page = await context.newPage();

  console.log('\nNavigating to claude.ai/code...');
  await page.goto('https://claude.ai/code', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the page to fully render
  await page.waitForTimeout(3000);

  // Take a screenshot for debugging
  const screenshotPath = resolve(__dirname, '.claude-sessions-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  // Get the page title to confirm we're logged in
  const title = await page.title();
  console.log('Page title:', title);

  // Get the full page HTML structure for analysis
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n--- Page Content ---');
  console.log(bodyText.substring(0, 3000));

  // Try to extract session/conversation elements
  // Note: selectors may need adjustment based on actual DOM structure
  const sessions = await page.evaluate(() => {
    const items = [];
    // Try common patterns for session list items
    const selectors = [
      '[data-testid*="session"]',
      '[data-testid*="conversation"]',
      '[class*="session"]',
      '[class*="conversation"]',
      'a[href*="/code/"]',
      '[role="listitem"]',
      '[class*="list"] > div',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach((el) => {
          items.push({
            selector,
            text: el.innerText?.substring(0, 200),
            href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href'),
          });
        });
        break; // Use the first selector that matches
      }
    }
    return items;
  });

  if (sessions.length > 0) {
    console.log('\n--- Sessions Found ---');
    sessions.forEach((s, i) => {
      console.log(`\n[${i + 1}] ${s.text}`);
      if (s.href) console.log(`    URL: ${s.href}`);
    });
  } else {
    console.log('\nNo sessions found via common selectors.');
    console.log('Check the screenshot to see what the page looks like.');
  }

  // Save updated auth state in case cookies were refreshed
  await context.storageState({ path: authStatePath });
  await browser.close();
}

// CLI entry point
const command = process.argv[2];

if (command === 'login') {
  // Force re-login by deleting existing state
  const fs = await import('fs');
  if (existsSync(AUTH_STATE_PATH)) {
    fs.unlinkSync(AUTH_STATE_PATH);
    console.log('Cleared existing auth state.');
  }
  await getOrCreateAuthState();
} else {
  await scrapeCloudSessions();
}
