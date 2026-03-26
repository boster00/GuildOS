// ARCHIVED: Original path was scripts/seed-metering-test-data.js

#!/usr/bin/env node
/**
 * Seed metering test data for /tests/metering-rollout test page.
 * Creates or updates profiles and user_credits for test scenarios.
 *
 * Usage: node scripts/seed-metering-test-data.js [userId]
 *   userId: optional UUID of existing user to seed. If omitted, uses METERING_TEST_USER_ID env.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Use /tests/metering-rollout page "Seed scenario" button to switch between scenarios (1.1-1.7).
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userId = process.argv[2] || process.env.METERING_TEST_USER_ID;
if (!userId) {
  console.error('Usage: node scripts/seed-metering-test-data.js <userId>');
  console.error('  Or set METERING_TEST_USER_ID env var');
  process.exit(1);
}

const supabase = createClient(url, key);

function getNextMonthReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

async function seed() {
  console.log('Seeding metering test data for user:', userId);

  await supabase.from('profiles').upsert({
    id: userId,
    subscription_plan: 'free',
  }, { onConflict: 'id' });

  await supabase.from('user_credits').upsert({
    user_id: userId,
    monthly_credits_used: 10,
    monthly_usage_reset_at: getNextMonthReset(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  console.log('Default state: free_low (10/100 credits)');
  console.log('Use /tests/metering-rollout page and "Seed scenario" button to switch scenarios.');
  console.log('Scenarios: 1.1 (50/100), 1.2 (98/100), 1.3 (105/100), 1.4 (112/100), 1.5 (pro), 1.6 (override), 1.7 (reset)');
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
