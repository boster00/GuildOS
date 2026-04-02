import Stripe from "stripe";
import { NextResponse } from "next/server";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

/**
 * In production, rejects sandbox price IDs (membership in known sandbox IDs).
 * Use before createCheckout / createPaygCheckout to guard against misconfiguration or crafted requests.
 * @param {string} priceId - Stripe price ID
 * @returns {NextResponse | null} 400 response to return, or null if allowed
 */
export function assertNoSandboxPricesInProd(priceId) {
  if (process.env.NODE_ENV !== "production") return null;
  if (!priceId || !subscriptionTiers.isSandboxPriceId(priceId)) return null;
  return NextResponse.json({ error: "Sandbox price IDs not allowed in production" }, { status: 400 });
}

// This is used to create a Stripe Checkout for one-time payments. It's usually triggered with the <ButtonCheckout /> component. Webhooks are used to update the user's state in the database.
function getStripeSecretKey(useSandbox) {
  const secretKey =
    useSandbox && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      : process.env.STRIPE_SECRET_KEY;
  if (!secretKey || typeof secretKey !== "string" || !secretKey.startsWith("sk_")) {
    const varName = useSandbox ? "STRIPE_SECRET_SANDBOX_TEST_KEY" : "STRIPE_SECRET_KEY";
    throw new Error(
      `Stripe secret key is not configured. Set ${varName} in your environment (e.g. Vercel project settings for production).`
    );
  }
  return secretKey;
}

export const createCheckout = async ({
  priceId,
  mode,
  successUrl,
  cancelUrl,
  couponId,
  clientReferenceId,
  user,
  useSandbox = false,
}) => {
  const secretKey = getStripeSecretKey(useSandbox);
  const stripe = new Stripe(secretKey);

  const extraParams = {};

  if (user?.customerId) {
    extraParams.customer = user.customerId;
  } else {
    if (mode === "payment") {
      extraParams.customer_creation = "always";
      // The option below costs 0.4% (up to $2) per invoice. Alternatively, you can use https://zenvoice.io/ to create unlimited invoices automatically.
      // extraParams.invoice_creation = { enabled: true };
      extraParams.payment_intent_data = { setup_future_usage: "on_session" };
    }
    if (user?.email) {
      extraParams.customer_email = user.email;
    }
    extraParams.tax_id_collection = { enabled: true };
  }

  const stripeSession = await stripe.checkout.sessions.create({
    mode,
    allow_promotion_codes: true,
    client_reference_id: clientReferenceId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    discounts: couponId
      ? [
          {
            coupon: couponId,
          },
        ]
      : [],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...extraParams,
  });

  return stripeSession.url;
};

/**
 * Create a Stripe Checkout Session for one-time PAYG credit purchase.
 * Uses priceId (per-unit PAYG price), quantity = credits, and session metadata for webhook.
 */
export const createPaygCheckout = async ({
  priceId,
  quantity,
  metadata,
  successUrl,
  cancelUrl,
  clientReferenceId,
  user,
  useSandbox = false,
}) => {
  const secretKey = getStripeSecretKey(useSandbox);
  const stripe = new Stripe(secretKey);

  const extraParams = {};

  if (user?.customerId) {
    extraParams.customer = user.customerId;
  } else {
    extraParams.customer_creation = "always";
    extraParams.payment_intent_data = { setup_future_usage: "on_session" };
    if (user?.email) {
      extraParams.customer_email = user.email;
    }
    extraParams.tax_id_collection = { enabled: true };
  }

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    allow_promotion_codes: true,
    client_reference_id: clientReferenceId,
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    metadata: metadata || {},
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...extraParams,
  });

  return stripeSession.url;
};

/**
 * Update an existing subscription to a lower-priced plan, deferring the change to the next
 * billing cycle with no immediate proration charge. The Stripe-side price change is immediate
 * so the customer is billed the lower amount at renewal; credit changes are handled by the
 * app's cron reset at credits_reset_at.
 */
export const scheduleSubscriptionDowngrade = async ({ subscriptionId, newPriceId, useSandbox = false }) => {
  const secretKey = getStripeSecretKey(useSandbox);
  const stripe = new Stripe(secretKey);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("No subscription item found for downgrade");
  await stripe.subscriptions.update(subscriptionId, {
    proration_behavior: "none",
    items: [{ id: itemId, price: newPriceId }],
  });
};

/**
 * Cancel a subscription at the end of the current billing period.
 * The subscription stays active until period end; Stripe fires customer.subscription.deleted
 * at that point which the webhook handler uses to set subscription_plan → free.
 */
export const cancelSubscriptionAtPeriodEnd = async ({ subscriptionId, useSandbox = false }) => {
  const stripe = new Stripe(getStripeSecretKey(useSandbox));
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
};

/**
 * Update an existing subscription to a higher-priced plan immediately.
 * Uses always_invoice so Stripe generates and immediately collects the proration invoice
 * before returning. Uses pending_if_incomplete so if payment fails the subscription update
 * is abandoned and the subscription stays unchanged (Stripe throws).
 *
 * prorationDate should be the same unix timestamp used in the preview call so the
 * charged amount exactly matches what was shown to the user.
 *
 * idempotencyKey prevents double-charge on network retries or double-clicks.
 */
export const upgradeSubscription = async ({
  subscriptionId,
  newPriceId,
  prorationDate,
  idempotencyKey,
  useSandbox = false,
}) => {
  const secretKey = getStripeSecretKey(useSandbox);
  const stripe = new Stripe(secretKey);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("No subscription item found for upgrade");

  const requestOptions = idempotencyKey ? { idempotencyKey } : {};

  await stripe.subscriptions.update(
    subscriptionId,
    {
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      items: [{ id: itemId, price: newPriceId }],
      ...(prorationDate ? { proration_date: prorationDate } : {}),
    },
    requestOptions
  );
};

// This is used to create Customer Portal sessions, so users can manage their subscriptions (payment methods, cancel, etc..)
export const createCustomerPortal = async ({ customerId, returnUrl, useSandbox = false }) => {
  try {
    const secretKey = getStripeSecretKey(useSandbox);
    const stripe = new Stripe(secretKey);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return portalSession.url;
  } catch (e) {
    return null;
  }
};

// This is used to get the uesr checkout session and populate the data so we get the planId the user subscribed to
export const findCheckoutSession = async (sessionId, useSandbox = false) => {
  try {
    const secretKey = getStripeSecretKey(useSandbox);
    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    return session;
  } catch (e) {
    return null;
  }
};
