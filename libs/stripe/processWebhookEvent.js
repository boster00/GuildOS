/**
 * Shared webhook event processing logic for invoice.paid, customer.subscription.updated, customer.subscription.deleted.
 * State (plan + period dates) on subscription.updated; credit grant only on invoice.paid via Master of Coins API.
 */

import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";
import creditPolicy from "@/libs/monkey/creditPolicy.js";
import { findSubscriptionPriceId } from "@/libs/stripe/helpers.js";
import { cancelSubscription } from "@/libs/monkey/subscriptionProvisioner.js";
import crypto from "crypto";

const resolveTierFromPriceId = subscriptionTiers.resolveTierFromPriceId;
const computeCreditGrant = creditPolicy.computeCreditGrant;

function idempotencyKeyFromEventId(eventId) {
  const hash = crypto.createHash("sha256").update(String(eventId)).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Idempotency key for new-subscription credit grant. Shared by checkout.session.completed
 * and invoice.paid (subscription_create) so exactly one ledger row is created per subscription.
 * @param {string} subscriptionId - Stripe subscription id (sub_xxx)
 * @returns {string}
 */
export function idempotencyKeyForNewSubscription(subscriptionId) {
  if (!subscriptionId) return idempotencyKeyFromEventId("subscription_start_missing");
  const hash = crypto.createHash("sha256").update(`subscription_start_${subscriptionId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Call Master of Coins API (mode=immediate for upgrade grant).
 * @param {object} payload
 * @returns {Promise<{ ok?: boolean, error?: string }>}
 */
async function callMasterOfCoinsImmediate(payload) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const masterOfCoinsUrl = `${origin}/api/master-of-coins`;
  const secret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;

  if (!secret) {
    return { ok: false, error: "Server misconfigured" };
  }

  const res = await fetch(masterOfCoinsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ mode: "immediate", ...payload }),
  });

  const data = await res.json().catch((parseErr) => {
    return {};
  });

  if (!res.ok) {
    return { ok: false, error: data.error || res.statusText };
  }
  return data;
}

/**
 * Derive fromPlan (oldTierId) and toPlan (newTierId) from invoice line items.
 * Do not use profile.subscription_plan as oldTierId — it may already be updated by customer.subscription.updated.
 * @param {object} stripeObject - Stripe invoice object
 * @param {{ subscription_plan?: string } | null} profile - Profile for fallback only
 * @param {string} primaryPriceId - Price ID from findSubscriptionPriceId
 * @returns {{ oldTierId: string, newTierId: string | null }}
 */
function deriveFromPlanToPlanFromInvoiceLines(stripeObject, profile, primaryPriceId) {
  const invoiceLines = stripeObject?.lines?.data || [];
  const subscriptionLines = invoiceLines.filter((line) => line.type === "subscription");
  const prorationLines = subscriptionLines.filter((line) => line.proration);
  const regularLines = subscriptionLines.filter((line) => !line.proration);

  let oldTierId = null;
  let newTierId = null;

  if (prorationLines.length > 0) {
    const oldPlanLine = prorationLines.find((line) => line.amount < 0);
    if (oldPlanLine?.price?.id) {
      oldTierId = resolveTierFromPriceId(oldPlanLine.price.id);
    }
  }

  const newPlanLine = regularLines[0] || prorationLines.find((line) => line.amount >= 0);
  if (newPlanLine?.price?.id) {
    newTierId = resolveTierFromPriceId(newPlanLine.price.id);
  }

  if (!oldTierId) {
    // previous_plan is written by upgrade-subscription before webhooks fire, giving a
    // reliable fromPlan even when customer.subscription.updated has already updated the
    // live subscription_plan or when shared sandbox price IDs prevent correct resolution.
    oldTierId = profile?.subscription_meta?.previous_plan
             || profile?.subscription_plan
             || "free";
  }
  if (!newTierId) {
    newTierId = resolveTierFromPriceId(primaryPriceId);
  }

  return { oldTierId, newTierId };
}

/**
 * Handle invoice.paid or invoice.payment_succeeded: derive from/to from invoice lines, grant credits if upgrade.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, type: string, data: { object: object } }} event
 */
async function handleInvoicePaidOrPaymentSucceeded(supabase, event) {
  const stripeObject = event.data.object;
  const customerId = stripeObject.customer;
  const subscriptionId = stripeObject.subscription;

  const priceId = findSubscriptionPriceId(stripeObject);
  if (!priceId) {
    return;
  }

  let { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id, subscription_plan, subscription_meta, subscription_period_start_at, credits_reset_at, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile && subscriptionId) {
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id, subscription_plan, subscription_meta, subscription_period_start_at, credits_reset_at, stripe_subscription_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();
    profile = fallback;
  }

  if (!profile) {
    return;
  }

  const { oldTierId, newTierId } = deriveFromPlanToPlanFromInvoiceLines(stripeObject, profile, priceId);

  if (!newTierId) {
    return;
  }

  const { amount: creditAmount, isUpgrade } = computeCreditGrant({
    oldPlan: oldTierId,
    newPlan: newTierId,
    invoice: stripeObject,
  });

  let period_end_at = profile.credits_reset_at || new Date().toISOString();
  let period_start_at = profile.subscription_period_start_at || null;
  if (!period_start_at && period_end_at) {
    const end = new Date(period_end_at);
    end.setUTCMonth(end.getUTCMonth() - 1);
    period_start_at = end.toISOString();
  }
  if (!period_start_at) period_start_at = period_end_at;

  if (isUpgrade && creditAmount > 0) {
    const idempotencyKey = idempotencyKeyFromEventId(event.id);
    await callMasterOfCoinsImmediate({
      profileId: profile.id,
      fromPlan: oldTierId,
      toPlan: newTierId,
      period_start_at,
      period_end_at,
      now: new Date().toISOString(),
      idempotencyKey,
      invoiceId: stripeObject.id,
      subscriptionId: subscriptionId || profile.stripe_subscription_id,
    });
  } else if (stripeObject.billing_reason === "subscription_create" && newTierId) {
    // subscription_create: grant prorated delta from user's current plan to newTier.
    // Idempotency key is subscription-based so checkout.session.completed and invoice.paid
    // share the same key — exactly one ledger row is created per subscription.
    const fromPlan = profile.subscription_plan || "free";
    const idempotencyKey = idempotencyKeyForNewSubscription(subscriptionId || profile.stripe_subscription_id);
    await callMasterOfCoinsImmediate({
      profileId: profile.id,
      fromPlan,
      toPlan: newTierId,
      period_start_at,
      period_end_at,
      now: new Date().toISOString(),
      idempotencyKey,
      invoiceId: stripeObject.id,
      subscriptionId: subscriptionId || profile.stripe_subscription_id,
    });
  }
}

/**
 * Process a Stripe webhook event (subscription.updated, subscription.deleted, invoice.paid, invoice.payment_succeeded).
 * Does not verify signature or insert into stripe_webhook_events; caller must do that.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, type: string, data: { object: object } }} event
 */
export async function processWebhookEvent(supabase, event) {
  const eventType = event.type;

  try {
    switch (eventType) {
      case "customer.subscription.updated": {
        const stripeObject = event.data.object;
        const subscriptionId = stripeObject.id;
        const customerId = stripeObject.customer;
        const priceId = stripeObject.items?.data?.[0]?.price?.id || null;
        const currentPeriodEnd = stripeObject.current_period_end
          ? new Date(stripeObject.current_period_end * 1000).toISOString()
          : null;
        const currentPeriodStart = stripeObject.current_period_start
          ? new Date(stripeObject.current_period_start * 1000).toISOString()
          : null;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, stripe_subscription_id, subscription_plan, subscription_meta, credits_reset_at, coins_work_order")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) break;

        const tierId = priceId ? resolveTierFromPriceId(priceId) : null;
        const effective_reset = currentPeriodEnd;
        const effective_start = currentPeriodStart;

        const updatePayload = { stripe_subscription_id: subscriptionId };
        if (effective_reset) updatePayload.credits_reset_at = effective_reset;
        if (effective_start) updatePayload.subscription_period_start_at = effective_start;
        if (effective_reset || effective_start || priceId) {
          const meta = { ...(profile.subscription_meta || {}) };
          if (effective_start) meta.period_start = effective_start;
          if (effective_reset) meta.period_end = effective_reset;
          if (priceId) meta.price_id = priceId;
          if (subscriptionId) meta.subscription_id = subscriptionId;
          updatePayload.subscription_meta = meta;
        }
        const hasPendingDowngrade = profile.coins_work_order?.pending_change?.type === "downgrade";
        // pending_plan is written by upgrade-subscription before Stripe fires webhooks.
        // Use it as the authoritative new plan to avoid misresolution when multiple tiers
        // share the same sandbox price ID. Clear it once applied.
        const pendingPlan = profile.subscription_meta?.pending_plan;
        const resolvedTierId = pendingPlan || tierId;
        if (resolvedTierId && !hasPendingDowngrade) updatePayload.subscription_plan = resolvedTierId;
        if (pendingPlan && updatePayload.subscription_meta) {
          delete updatePayload.subscription_meta.pending_plan;
        }

        await supabase.from("profiles").update(updatePayload).eq("id", profile.id);
        break;
      }

      case "customer.subscription.deleted": {
        const stripeObject = event.data.object;
        const customerId = stripeObject.customer;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile?.id) {
          await cancelSubscription(supabase, { userId: profile.id });
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaidOrPaymentSucceeded(supabase, event);
        break;

      case "checkout.session.expired":
      case "invoice.payment_failed":
      default:
        break;
    }
  } catch (e) {
    throw e;
  }
}
