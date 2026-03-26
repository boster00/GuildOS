// ARCHIVED: Original path was libs/cron/startCron.js

import dotenv from 'dotenv';

// Load env FIRST
dotenv.config({ path: '.env.local' });

import schedule from 'node-cron';
import cron from './class.js';

const CRON_ACTIVE = process.env.CRON_ACTIVE === 'true';
const CRON_INTERVAL_MINUTES = process.env.CRON_INTERVAL_MINUTES || 1;

if (!CRON_ACTIVE) {
  console.log('CRON_ACTIVE=false');
  process.exit(0);
}

// Initialize cron before scheduling
await cron.init();

const cronSchedule = `0 0 * * *`;
// const cronSchedule = `*/${CRON_INTERVAL_MINUTES} * * * *`;

schedule.schedule(cronSchedule, async () => {
  await cron.pingCronAPI();
});

// console.log(`✅ Cron started - interval: ${CRON_INTERVAL_MINUTES} minute(s)`);
console.log(`✅ Cron started - interval: 1 day`);
process.stdin.resume();

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});