// ARCHIVED: Original path was libs/cron/config.js

export const CRON_CONFIG = {
  BATCH_SIZE: 10,           // Jobs per request
  DUE_TIME_SECONDS: 360,    // Stuck job threshold
  MAX_RETRIES: 3,           // Retry limit
  SCAN_INTERVAL_DAYS: 7,    // Reschedule interval
  WORKER_TIMEOUT_MS: 30000, // Worker request timeout
};