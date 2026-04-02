import dotenv from "dotenv";
import cron from "node-cron";
import { runCron } from "./index.js";

dotenv.config({ path: ".env.local" });

cron.schedule("*/5 * * * *", async () => {
  console.log("[cron:5min] tick", new Date().toISOString());
  try {
    const log = await runCron();
    console.log("[cron:5min]", JSON.stringify(log, null, 2));
  } catch (err) {
    console.error("[cron:5min] error:", err);
  }
});

console.log("[cron] 5-min schedule active");
