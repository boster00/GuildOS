// ARCHIVED: Original path was libs/monkey/registry/subscriptionTiers.js

/**
 * Subscription tier definitions (source of truth).
 * profiles.subscription_plan values: free | starter | pro
 * Stripe Checkout uses price IDs from env: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO (price_xxx).
 * STRIPE_PRODUCT_ID_* in env are for reference; tier → price resolution uses STRIPE_PRICE_*.
 */

/** @type {Array<{
 *   id: string,
 *   name: string,
 *   stripePriceId: string | null,
 *   stripePriceIdSandbox?: string | null,
 *   monthlyPrice: number,
 *   monthlyCreditQuota: number,
 *   paygPricePerCredit: number | null,
 *   concurrency: number,
 *   maxPendingExternal: number,
 *   maxProjects: number | string,
 *   scheduledRuns: string,
 *   dataRetention: string,
 *   icpSlots: string,
 *   offersSlots: string,
 *   keywordsCap: string,
 *   promptsCap: string,
 * }>} */
const TIERS = [
  {
    id: "free",
    name: "Free",
    stripePriceId: null,
    monthlyPrice: 0,
    monthlyCreditQuota: 50,
    paygPricePerCredit: null,
    concurrency: 0,
    maxPendingExternal: 1,
    maxProjects: 1,
    scheduledRuns: "monthly",
    dataRetention: "standard",
    icpSlots: "limited",
    offersSlots: "limited",
    keywordsCap: "starter",
    promptsCap: "starter",
  },
  {
    id: "starter",
    name: "Starter",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
    stripePriceIdSandbox: process.env.STRIPE_PRICE_STARTER_SANDBOX_TEST || null,
    monthlyPrice: 99,
    monthlyCreditQuota: 500,
    paygPricePerCredit: 0.5,
    concurrency: 1,
    maxPendingExternal: 1,
    maxProjects: 1,
    scheduledRuns: "monthly",
    dataRetention: "standard",
    icpSlots: "limited",
    offersSlots: "limited",
    keywordsCap: "starter",
    promptsCap: "starter",
  },
  {
    id: "pro",
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null,
    stripePriceIdSandbox: process.env.STRIPE_PRICE_PRO_SANDBOX_TEST || null,
    monthlyPrice: 399,
    monthlyCreditQuota: 4000,
    paygPricePerCredit: 0.1,
    concurrency: 3,
    maxPendingExternal: 3,
    maxProjects: "higher",
    scheduledRuns: "daily_weekly",
    dataRetention: "extended",
    icpSlots: "expanded",
    offersSlots: "expanded",
    keywordsCap: "high",
    promptsCap: "high",
  },
];

const DEFAULT_MONTHLY_CREDITS = 50;

/**
 * @param {string} tierId
 * @returns {(typeof TIERS)[number] | null}
 */
function getTierById(tierId) {
  return TIERS.find((t) => t.id === (tierId || "free")) || TIERS.find((t) => t.id === "free") || null;
}

/**
 * Check if a price ID is a sandbox test price ID.
 * @param {string} priceId - Stripe price ID (price_xxx)
 * @returns {boolean} True if priceId matches any sandbox price ID
 */
function isSandboxPriceId(priceId) {
  if (!priceId) return false;
  return TIERS.some((t) => t.stripePriceIdSandbox && t.stripePriceIdSandbox === priceId);
}

/**
 * Resolve tier ID from Stripe price ID. Single source of truth for price → plan mapping.
 * Checks both regular and sandbox price IDs.
 * When a price ID matches multiple tiers (e.g. Test and Starter share same sandbox price),
 * prefer starter over test so checkout for "Starter" results in subscription_plan = "starter".
 * @param {string} priceId - Stripe price ID (price_xxx)
 * @returns {string | null} Tier ID (test|starter|pro) or null
 */
function resolveTierFromPriceId(priceId) {
  if (!priceId) return null;
  const matches = TIERS.filter(
    (t) =>
      (t.stripePriceId && t.stripePriceId === priceId) ||
      (t.stripePriceIdSandbox && t.stripePriceIdSandbox === priceId)
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].id;
  // Prefer starter over pro when multiple tiers share the same sandbox price ID
  const starter = matches.find((t) => t.id === "starter");
  const pro = matches.find((t) => t.id === "pro");
  return (starter || pro || matches[0]).id;
}

/** @deprecated Use resolveTierFromPriceId */
function getTierIdByPriceId(priceId) {
  return resolveTierFromPriceId(priceId);
}

/**
 * All tiers (for APIs that return list; omit stripePriceId for client unless requested).
 * @param {{ includeStripePriceId?: boolean }} [opts]
 * @returns {Array<Omit<(typeof TIERS)[number], 'stripePriceId'> & { stripePriceId?: string | null }>}
 */
function getAllTiers(opts = {}) {
  return TIERS.map((t) => {
    const { stripePriceId, ...rest } = t;
    const out = { ...rest };
    if (opts.includeStripePriceId) out.stripePriceId = stripePriceId;
    return out;
  });
}

/**
 * Limits for a tier (for PlanContext). Uses tier id; defaults to free tier limits when unknown.
 * @param {string} tierId
 * @returns {{ monthlyCreditQuota: number, maxPendingExternal: number, maxProjects: number | string, scheduledRuns: string, dataRetention: string }}
 */
function getLimitsForTierId(tierId) {
  const tier = getTierById(tierId);
  if (!tier) {
    const free = getTierById("free");
    return free
      ? {
          monthlyCreditQuota: free.monthlyCreditQuota,
          maxPendingExternal: free.maxPendingExternal ?? 1,
          maxProjects: free.maxProjects,
          scheduledRuns: free.scheduledRuns,
          dataRetention: free.dataRetention,
        }
      : {
          monthlyCreditQuota: DEFAULT_MONTHLY_CREDITS,
          maxPendingExternal: 1,
          maxProjects: 1,
          scheduledRuns: "monthly",
          dataRetention: "standard",
        };
  }
  return {
    monthlyCreditQuota: tier.monthlyCreditQuota,
    maxPendingExternal: tier.maxPendingExternal ?? 1,
    maxProjects: tier.maxProjects,
    scheduledRuns: tier.scheduledRuns,
    dataRetention: tier.dataRetention,
  };
}

module.exports = {
  TIERS,
  DEFAULT_MONTHLY_CREDITS,
  getTierById,
  getTierIdByPriceId,
  resolveTierFromPriceId,
  getAllTiers,
  getLimitsForTierId,
  isSandboxPriceId,
};
