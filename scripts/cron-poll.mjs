/**
 * Polls the cron API route every 5 minutes.
 * Runs alongside `next dev` via `npm run dev`.
 * Waits 10s on startup for the dev server to be ready.
 */
const INTERVAL_MS = 5 * 60 * 1000;
const BASE_URL = process.env.CRON_BASE_URL || "http://localhost:3002";

async function tick() {
  try {
    const res = await fetch(`${BASE_URL}/api/council/cron/trigger`);
    const data = await res.json();
    console.log(`[cron] ${new Date().toISOString()}`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[cron] ${new Date().toISOString()} error:`, err.message);
  }
}

// Wait for dev server to start
await new Promise((r) => setTimeout(r, 10_000));
console.log("[cron] polling started (every 5 min)");

tick();
setInterval(tick, INTERVAL_MS);
