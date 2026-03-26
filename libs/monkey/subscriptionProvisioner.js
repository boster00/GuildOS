/**
 * Centralized subscription provisioning: profile update only.
 * Credit granting for Stripe happens in invoice.paid webhook (Policy B).
 * Sandbox uses provisionSubscriptionSandbox to mimic full flow (plan + grant).
 */

import { getTierById } from "./registry/subscriptionTiers.js";
import { grantSandboxSubscription } from "./masterOfCoins/index.js";

function getNextMonthReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

/**
 * Provision subscription: set tier on profile, optionally Stripe IDs. No credit grant.
 * Used by checkout.session.completed (Stripe) and by provisionSubscriptionSandbox.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, tierId: string, source: 'stripe'|'sandbox', customerId?: string, subscriptionId?: string }} opts
 * @returns {Promise<{ ok: boolean }>}
 */
export async function provisionSubscription(supabase, opts) {
  const { userId, tierId, source, customerId, subscriptionId } = opts;
  if (!userId || !tierId || !source) {
    throw new Error("provisionSubscription: userId, tierId, source required");
  }

  const tier = getTierById(tierId);
  if (!tier) {
    throw new Error(`provisionSubscription: unknown tier ${tierId}`);
  }

  const profileUpdate = {
    subscription_plan: tierId,
    credits_reset_at: getNextMonthReset(),
  };
  if (customerId) profileUpdate.stripe_customer_id = customerId;
  if (subscriptionId) profileUpdate.stripe_subscription_id = subscriptionId;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (profileError) throw profileError;
  return { ok: true };
}

/**
 * Sandbox-only: set plan and grant monthly credits (mimics full Stripe flow).
 * Used by /api/billing/sandbox-subscribe.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, tierId: string, idempotencyKey: string }} opts
 * @returns {Promise<{ ok: boolean, granted: boolean }>}
 */
export async function provisionSubscriptionSandbox(supabase, opts) {
  const { userId, tierId, idempotencyKey } = opts;
  if (!userId || !tierId || !idempotencyKey) {
    throw new Error("provisionSubscriptionSandbox: userId, tierId, idempotencyKey required");
  }

  await provisionSubscription(supabase, { ...opts, source: "sandbox" });

  const result = await grantSandboxSubscription(supabase, {
    userId,
    tierId,
    idempotencyKey,
  });

  return { ok: result.ok, granted: Boolean(result.granted) };
}

/**
 * Cancel subscription: set tier to free. No credit grant.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string }} opts
 * @returns {Promise<{ ok: boolean }>}
 */
export async function cancelSubscription(supabase, { userId }) {
  if (!userId) throw new Error("cancelSubscription: userId required");

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_plan: "free", stripe_subscription_id: null })
    .eq("id", userId);

  if (error) throw error;
  return { ok: true };
}
