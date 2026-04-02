import { runCron } from "./index.js";

/**
 * Manual / API trigger: run the same cron action once and return a timestamped result.
 */
export async function cronRunOnce() {
  const at = new Date().toISOString();
  console.log(`[council/cron] cron run at ${at}`);
  const log = await runCron();
  return { at, line: `cron run at ${at}`, log };
}
