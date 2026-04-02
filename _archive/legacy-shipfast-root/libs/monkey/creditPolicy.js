/**
 * Policy B: credit grant computation (upgrade delta vs full renewal).
 * Single source of truth for invoice.paid credit logic to prevent drift.
 */

const { getTierById } = require("./registry/subscriptionTiers.js");

/** Tier order for "higher" plan comparison (index = rank). */
const TIER_ORDER = ["free", "test", "test2", "starter", "pro"];

function tierRank(planId) {
  const i = TIER_ORDER.indexOf(planId || "free");
  return i === -1 ? -1 : i;
}

/**
 * Compute credit grant amount using Policy B (upgrade delta).
 * Upgrade = subscription_update AND new plan is higher than old → grant delta.
 * Downgrade or lateral → grant 0. Ambiguous → grant 0 (safe).
 *
 * @param {Object} opts
 * @param {string} opts.oldPlan - Current subscription_plan from DB
 * @param {string} opts.newPlan - New plan from invoice priceId
 * @param {Object} opts.invoice - Stripe invoice object (billing_reason, lines.data)
 * @returns {{ amount: number, reason: string, isUpgrade: boolean }}
 */
function computeCreditGrant({ oldPlan, newPlan, invoice }) {
  const billingReason = invoice?.billing_reason;
  const hasProration = invoice?.lines?.data?.some((ln) => ln.proration) || false;

  const oldTier = getTierById(oldPlan || "free");
  const newTier = getTierById(newPlan);

  if (!newTier) {
    return { amount: 0, reason: "unknown_plan", isUpgrade: false };
  }

  const isSubscriptionUpdate = billingReason === "subscription_update" || hasProration;
  const newIsHigher = tierRank(newPlan) > tierRank(oldPlan || "free");

  // Upgrade invoice only: subscription_update AND new plan is higher
  const isUpgrade = isSubscriptionUpdate && newIsHigher;

  let amount;
  let reason;

  if (isUpgrade) {
    const oldQuota = oldTier?.monthlyCreditQuota ?? 0;
    const newQuota = newTier.monthlyCreditQuota ?? 0;
    amount = Math.max(0, newQuota - oldQuota);
    reason = `upgrade_delta_${oldPlan}_to_${newPlan}`;
  } else {
    // Renewal: full quota. Downgrade/lateral/ambiguous: 0.
    if (billingReason === "subscription_cycle") {
      amount = newTier.monthlyCreditQuota ?? 0;
      reason = `renewal_${newPlan}`;
    } else {
      amount = 0;
      reason = newIsHigher ? "ambiguous_no_grant" : `downgrade_or_lateral_${oldPlan}_to_${newPlan}`;
    }
  }

  if (amount < 0) {
    amount = 0;
    reason = `downgrade_skipped_${oldPlan}_to_${newPlan}`;
  }

  return { amount, reason, isUpgrade };
}

module.exports = {
  computeCreditGrant,
};
