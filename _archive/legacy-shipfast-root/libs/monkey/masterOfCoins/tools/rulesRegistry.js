/**
 * Master of Coins rules registry — central dispatch map for all credit-mutation modes.
 * Maps mode → { requiredFields, handler }. The API route uses this for validation and dispatch.
 */

const {
  scheduleDowngrade,
  processReset,
  applyImmediateUpgrade,
  grantPayg,
  grantSandboxSubscription,
  grantSignup,
} = require("../index.js");

const RULES = {
  immediate: {
    requiredFields: ["profileId", "fromPlan", "toPlan", "period_end_at", "now", "idempotencyKey"],
    handler: applyImmediateUpgrade,
  },
  reset: {
    requiredFields: [],
    handler: processReset,
  },
  schedule_downgrade: {
    requiredFields: ["profileId", "toPlan", "requested_at"],
    handler: scheduleDowngrade,
  },
  payg_purchase: {
    requiredFields: ["userId", "credits", "paygTier", "stripeEventId"],
    handler: grantPayg,
  },
  sandbox_grant: {
    requiredFields: ["userId", "tierId", "idempotencyKey"],
    handler: grantSandboxSubscription,
  },
  signup_grant: {
    requiredFields: ["userId"],
    handler: grantSignup,
  },
};

module.exports = { RULES };
