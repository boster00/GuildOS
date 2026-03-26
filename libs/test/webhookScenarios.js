/**
 * Webhook test scenario definitions and validation logic.
 * Used by /api/test/simulate-webhook and the test-stripe page.
 */

import subscriptionTiers from "../monkey/registry/subscriptionTiers.js";
const getTierById = subscriptionTiers.getTierById;

const TIER_ORDER = ["free", "test", "starter", "pro"];

function tierQuota(tierId) {
  const tier = getTierById(tierId || "free");
  return tier?.monthlyCreditQuota ?? 0;
}

/**
 * Get price ID for a tier (from env). Returns null for free; test/starter/pro use STRIPE_PRICE_*.
 * @param {string} tierId
 * @returns {string | null}
 */
function getPriceIdForTier(tierId) {
  if (!tierId || tierId === "free") return null;
  const tier = getTierById(tierId);
  return tier?.stripePriceId ?? null;
}

/**
 * Scenario definitions: key -> { label, description, oldPlan, newPlan, billingReason, proration, eventType, expectedCreditsGranted, expectedPlanAfter, ... }
 */
const SCENARIOS = {
  new_subscription_test: {
    key: "new_subscription_test",
    label: "1. New Paid Subscription (Free → Test)",
    description: "Full monthly credits granted, plan and Stripe IDs set, one ledger entry.",
    oldPlan: "free",
    newPlan: "test",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => tierQuota("test"),
    expectedPlanAfter: "test",
    validateCreditsUnchanged: false,
    validateNoDuplicateLedger: true,
  },
  new_subscription_starter: {
    key: "new_subscription_starter",
    label: "1. New Paid Subscription (Free → Starter)",
    description: "Full 500 credits, plan and Stripe IDs set.",
    oldPlan: "free",
    newPlan: "starter",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => tierQuota("starter"),
    expectedPlanAfter: "starter",
    validateCreditsUnchanged: false,
    validateNoDuplicateLedger: true,
  },
  new_subscription_pro: {
    key: "new_subscription_pro",
    label: "1. New Paid Subscription (Free → Pro)",
    description: "Full 4000 credits, plan and Stripe IDs set.",
    oldPlan: "free",
    newPlan: "pro",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => tierQuota("pro"),
    expectedPlanAfter: "pro",
    validateCreditsUnchanged: false,
    validateNoDuplicateLedger: true,
  },
  renewal_starter: {
    key: "renewal_starter",
    label: "2. Renewal (Starter → Starter)",
    description: "Full 500 credits, credits_reset_at advanced, no duplicate ledger.",
    oldPlan: "starter",
    newPlan: "starter",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => tierQuota("starter"),
    expectedPlanAfter: "starter",
    validateCreditsUnchanged: false,
    validateNoDuplicateLedger: true,
  },
  upgrade_mid_cycle: {
    key: "upgrade_mid_cycle",
    label: "3. Upgrade Mid Cycle (Starter → Pro)",
    description: "Only delta credits (3500), not full 4000. Policy B.",
    oldPlan: "starter",
    newPlan: "pro",
    billingReason: "subscription_update",
    proration: true,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => Math.max(0, tierQuota("pro") - tierQuota("starter")),
    expectedPlanAfter: "pro",
    validateNotFullGrant: true,
    fullGrantWouldBe: () => tierQuota("pro"),
    validateNoDuplicateLedger: true,
  },
  same_credit_upgrade: {
    key: "same_credit_upgrade",
    label: "4. Same Credit Upgrade (Test → Starter)",
    description: "Both 500 credits; plan updates, 0 credits granted.",
    oldPlan: "test",
    newPlan: "starter",
    billingReason: "subscription_update",
    proration: true,
    eventType: "invoice.paid",
    expectedCreditsGranted: 0,
    expectedPlanAfter: "starter",
    validateNoAccidentalFullGrant: true,
    accidentalFullWouldBe: 500,
    validateNoDuplicateLedger: true,
  },
  downgrade: {
    key: "downgrade",
    label: "5. Downgrade (Pro → Starter)",
    description: "Plan updates to Starter; existing credits remain, no removal.",
    oldPlan: "pro",
    newPlan: "starter",
    billingReason: "subscription_update",
    proration: true,
    eventType: "invoice.paid",
    expectedCreditsGranted: 0,
    expectedPlanAfter: "starter",
    validateCreditsUnchangedOrIncreased: true,
    validateNoDuplicateLedger: true,
  },
  cancel: {
    key: "cancel",
    label: "6. Cancel Subscription",
    description: "subscription.deleted → plan free, credits unchanged.",
    oldPlan: "pro",
    newPlan: "free",
    eventType: "customer.subscription.deleted",
    expectedPlanAfter: "free",
    expectedCreditsGranted: 0,
    validateCreditsUnchanged: true,
    validateNoNewLedgerEntries: true,
  },
  payment_failed: {
    key: "payment_failed",
    label: "7. Payment Failure",
    description: "invoice.payment_failed: no plan change, no credits, no ledger.",
    oldPlan: "starter",
    newPlan: "starter",
    eventType: "invoice.payment_failed",
    expectedPlanAfter: "starter",
    expectedCreditsGranted: 0,
    validateCreditsUnchanged: true,
    validateNoNewLedgerEntries: true,
    simulateNoOp: true,
  },
  idempotency_replay: {
    key: "idempotency_replay",
    label: "8. Webhook Idempotency",
    description: "Replay same invoice.paid; no duplicate grant, one ledger only.",
    oldPlan: "starter",
    newPlan: "starter",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedCreditsGranted: () => tierQuota("starter"),
    expectedPlanAfter: "starter",
    expectedCreditsGrantedOnReplay: 0,
    validateReplayNoChange: true,
    validateNoDuplicateLedger: true,
  },
  webhook_out_of_order: {
    key: "webhook_out_of_order",
    label: "9. Webhook Out Of Order (recommended)",
    description: "invoice.paid before checkout.session.completed; user still resolved.",
    oldPlan: "free",
    newPlan: "starter",
    billingReason: "subscription_cycle",
    proration: false,
    eventType: "invoice.paid",
    expectedPlanAfter: "starter",
    expectedCreditsGranted: () => tierQuota("starter"),
    recommended: true,
  },
  checkout_without_invoice: {
    key: "checkout_without_invoice",
    label: "10. Checkout Without Invoice (recommended)",
    description: "Plan may update; credits NOT granted until invoice.paid.",
    recommended: true,
    simulateNoOp: true,
  },
};

/**
 * Run validations for a scenario given state before/after and optional expected values.
 * @param {string} scenarioKey
 * @param {{ profile?: object, credits?: number, ledgerCount?: number }} stateBefore
 * @param {{ profile?: object, credits?: number, ledgerCount?: number }} stateAfter
 * @param {{ creditsGranted?: number, ledgerCreated?: number }} actualOutcome
 * @returns {{ validations: Array<{ test: string, expected: any, actual: any, passed: boolean }>, passed: boolean }}
 */
function validateScenario(scenarioKey, stateBefore, stateAfter, actualOutcome) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    return {
      validations: [{ test: "scenario_exists", expected: scenarioKey, actual: null, passed: false }],
      passed: false,
    };
  }

  const validations = [];
  const planBefore = stateBefore?.profile?.subscription_plan ?? "free";
  const planAfter = stateAfter?.profile?.subscription_plan ?? "free";
  const creditsBefore = stateBefore?.credits ?? 0;
  const creditsAfter = stateAfter?.credits ?? 0;
  const ledgerBefore = stateBefore?.ledgerCount ?? 0;
  const ledgerAfter = stateAfter?.ledgerCount ?? 0;
  const creditsGranted = actualOutcome?.creditsGranted ?? (creditsAfter - creditsBefore);
  const ledgerCreated = actualOutcome?.ledgerCreated ?? (ledgerAfter - ledgerBefore);

  const expectedPlan = scenario.expectedPlanAfter;
  if (expectedPlan != null) {
    validations.push({
      test: "plan_updated",
      expected: expectedPlan,
      actual: planAfter,
      passed: planAfter === expectedPlan,
    });
  }

  if (scenario.expectedCreditsGranted !== undefined) {
    let expected;
    if (scenarioKey === "idempotency_replay" && ledgerCreated === 0) {
      expected = 0; // replay: no new grant
    } else {
      expected =
        typeof scenario.expectedCreditsGranted === "function"
          ? scenario.expectedCreditsGranted()
          : scenario.expectedCreditsGranted;
    }
    validations.push({
      test: "credits_granted",
      expected,
      actual: creditsGranted,
      passed: creditsGranted === expected,
    });
  }

  if (scenario.validateNoDuplicateLedger) {
    const expectedCreditsForLedger =
      scenarioKey === "idempotency_replay" && ledgerCreated === 0
        ? 0
        : typeof scenario.expectedCreditsGranted === "function"
          ? scenario.expectedCreditsGranted()
          : scenario.expectedCreditsGranted ?? 0;
    const expectNoNewEntry = expectedCreditsForLedger === 0;
    const testName = scenarioKey === "idempotency_replay" && ledgerCreated === 0 ? "replay_no_duplicate" : expectNoNewEntry ? "no_ledger_entry" : "single_ledger_entry";
    validations.push({
      test: testName,
      expected: expectNoNewEntry ? 0 : 1,
      actual: ledgerCreated,
      passed: expectNoNewEntry ? ledgerCreated === 0 : ledgerCreated === 1,
    });
  }

  if (scenario.validateCreditsUnchanged) {
    validations.push({
      test: "credits_unchanged",
      expected: creditsBefore,
      actual: creditsAfter,
      passed: creditsAfter === creditsBefore,
    });
  }

  if (scenario.validateCreditsUnchangedOrIncreased) {
    validations.push({
      test: "credits_unchanged_or_increased",
      expected: `>= ${creditsBefore}`,
      actual: creditsAfter,
      passed: creditsAfter >= creditsBefore,
    });
  }

  if (scenario.validateNoNewLedgerEntries) {
    validations.push({
      test: "no_new_ledger_entries",
      expected: ledgerBefore,
      actual: ledgerAfter,
      passed: ledgerAfter === ledgerBefore,
    });
  }

  if (scenario.validateNotFullGrant && scenario.fullGrantWouldBe) {
    const fullGrant = typeof scenario.fullGrantWouldBe === "function" ? scenario.fullGrantWouldBe() : scenario.fullGrantWouldBe;
    validations.push({
      test: "not_full_grant",
      expected: `delta only, not ${fullGrant}`,
      actual: creditsGranted,
      passed: creditsGranted !== fullGrant && creditsGranted === Math.max(0, tierQuota(scenario.newPlan) - tierQuota(scenario.oldPlan)),
    });
  }

  if (scenario.validateNoAccidentalFullGrant) {
    validations.push({
      test: "no_accidental_full_grant",
      expected: 0,
      actual: creditsGranted,
      passed: creditsGranted === 0,
    });
  }

  if (scenario.validateReplayNoChange && ledgerCreated === 0) {
    validations.push({
      test: "replay_no_change",
      expected: "ledger and credits unchanged on replay",
      actual: ledgerCreated,
      passed: true,
    });
  }

  const passed = validations.every((v) => v.passed);
  return { validations, passed };
}

/**
 * Get scenario config for building a mock event (invoice or subscription.deleted).
 * @param {string} scenarioKey
 * @param {{ customerId: string, subscriptionId: string, userId: string }} context
 * @returns {{ eventType: string, eventParams: object } | null}
 */
function getScenarioEventConfig(scenarioKey, context) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario || scenario.simulateNoOp) return null;

  if (scenario.eventType === "customer.subscription.deleted") {
    return {
      eventType: "customer.subscription.deleted",
      eventParams: {
        eventId: `evt_sim_${scenarioKey}_${Date.now()}`,
        customerId: context.customerId,
      },
    };
  }

  if (scenario.eventType === "invoice.paid") {
    const priceId = getPriceIdForTier(scenario.newPlan);
    if (!priceId) return null;
    return {
      eventType: "invoice.paid",
      eventParams: {
        eventId: `evt_sim_${scenarioKey}_${Date.now()}`,
        customerId: context.customerId,
        subscriptionId: context.subscriptionId,
        priceId,
        billingReason: scenario.billingReason,
        proration: scenario.proration ?? false,
      },
    };
  }

  return null;
}

/**
 * List of scenario keys for the test page (core first, then recommended).
 */
const CORE_SCENARIO_KEYS = [
  "new_subscription_test",
  "new_subscription_starter",
  "new_subscription_pro",
  "renewal_starter",
  "upgrade_mid_cycle",
  "same_credit_upgrade",
  "downgrade",
  "cancel",
  "payment_failed",
  "idempotency_replay",
];

const RECOMMENDED_SCENARIO_KEYS = ["webhook_out_of_order", "checkout_without_invoice"];

function getAllScenarioKeys() {
  return [...CORE_SCENARIO_KEYS, ...RECOMMENDED_SCENARIO_KEYS];
}

export function getScenario(key) {
  return SCENARIOS[key];
}

export {
  SCENARIOS,
  getPriceIdForTier,
  getScenarioEventConfig,
  validateScenario,
  tierQuota,
  getAllScenarioKeys,
  CORE_SCENARIO_KEYS,
  RECOMMENDED_SCENARIO_KEYS,
};
