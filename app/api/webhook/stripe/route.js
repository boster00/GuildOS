import { findCheckoutSession } from "@/libs/stripe";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";
import { processWebhookEvent, idempotencyKeyForNewSubscription } from "@/libs/stripe/processWebhookEvent.js";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const resolveTierFromPriceId = subscriptionTiers.resolveTierFromPriceId;
const isSandboxPriceId = subscriptionTiers.isSandboxPriceId;

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const monkey = await initMonkey();
  let requestId = null;
  if (monkey.diag.enabled()) {
    requestId = monkey.diag.genRequestId();
  }

  // Start with default Stripe instance for webhook signature verification
  // Try both webhook secrets (regular and sandbox) since we can't detect mode from cookies in webhooks
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecretSandbox = process.env.STRIPE_WEBHOOK_SECRET_SANDBOX_TEST;
  
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  let event;
  let usedSandboxSecret = false;
  
  // Try regular webhook secret first, then sandbox secret
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    if (webhookSecretSandbox) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecretSandbox);
        usedSandboxSecret = true;
      } catch (sandboxErr) {
        if (monkey.diag.enabled()) {
          monkey.diag.log("error", "stripe webhook signature verification failed", { error_name: err?.name, message: err?.message }, { request_id: requestId, source: "webhook" });
          await monkey.diag.flush({ request_id: requestId, source: "webhook" });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else {
      if (monkey.diag.enabled()) {
        monkey.diag.log("error", "stripe webhook signature verification failed", { error_name: err?.name, message: err?.message }, { request_id: requestId, source: "webhook" });
        await monkey.diag.flush({ request_id: requestId, source: "webhook" });
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  if (monkey.diag.enabled()) {
    monkey.diag.log("info", "stripe webhook received", { event_id: event.id, event_type: event.type }, { request_id: requestId, source: "webhook" });
  }
  const eventType = event.type;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false }, realtime: { disabled: true } }
  );

  // Resolve user_id deterministically before insert so the row is immediately queryable by user.
  // Priority: metadata.user_id → customer lookup → subscription lookup → client_reference_id
  const obj = event.data?.object ?? {};
  let resolvedUserId = null;
  if (obj.metadata?.user_id) {
    resolvedUserId = obj.metadata.user_id;
  } else if (obj.customer) {
    const { data: custProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", obj.customer)
      .maybeSingle();
    if (custProfile) resolvedUserId = custProfile.id;
  }
  if (!resolvedUserId && obj.subscription) {
    const { data: subProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", obj.subscription)
      .maybeSingle();
    if (subProfile) resolvedUserId = subProfile.id;
  }
  if (!resolvedUserId && obj.client_reference_id) {
    resolvedUserId = obj.client_reference_id;
  }

  // Build sanitized event_data subset (no payment method / card details)
  const sanitizedEventData = {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    created: event.created,
    object: {
      id: obj.id,
      object: obj.object,
      mode: obj.mode,
      status: obj.status,
      customer: obj.customer,
      subscription: obj.subscription,
      invoice: obj.invoice,
      billing_reason: obj.billing_reason,
      metadata: obj.metadata,
      client_reference_id: obj.client_reference_id,
      amount_paid: obj.amount_paid,
      amount_due: obj.amount_due,
      currency: obj.currency,
      lines: obj.lines
        ? { data: (obj.lines.data ?? []).map((l) => ({ id: l.id, price: l.price, quantity: l.quantity })) }
        : undefined,
    },
  };

  const webhookRow = {
    event_id: event.id,
    event_type: eventType,
    stripe_created_at: event.created ? new Date(event.created * 1000).toISOString() : null,
    livemode: event.livemode ?? null,
    stripe_customer_id: obj.customer ?? null,
    stripe_subscription_id: obj.subscription ?? null,
    stripe_invoice_id: obj.object === "invoice" ? obj.id : null,
    user_id: resolvedUserId ?? null,
    event_data: sanitizedEventData,
  };

  const { error: insertError } = await supabase
    .from("stripe_webhook_events")
    .insert(webhookRow);
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({});
    }
    return NextResponse.json({ error: "Idempotency check failed" }, { status: 500 });
  }

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const stripeObject = event.data.object;

        // Try sandbox keys first (dev only), then regular keys
        let session = null;
        if (process.env.NODE_ENV !== "production" && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY) {
          try {
            session = await findCheckoutSession(stripeObject.id, true);
          } catch (e) {
            // will retry with regular keys below
          }
        }
        if (!session) {
          try {
            session = await findCheckoutSession(stripeObject.id, false);
          } catch (e) {
            break;
          }
        }
        
        if (!session?.customer) {
          break;
        }

        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const priceId = session?.line_items?.data?.[0]?.price?.id;
        const userId = stripeObject.client_reference_id;

        // Detect sandbox mode from price ID
        const isSandboxMode = isSandboxPriceId(priceId);
        const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          : process.env.STRIPE_SECRET_KEY;
        const stripeInstance = new Stripe(secretKey, { apiVersion: "2023-08-16" });

        const customer = await stripeInstance.customers.retrieve(customerId);
        if (customer.deleted) {
          break;
        }

        let user;
        if (!userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", customer.email)
            .single();
          if (profile) {
            user = profile;
          } else {
            const { data, error: authError } = await supabase.auth.admin.createUser({ email: customer.email });
            if (authError) {
              throw authError;
            }
            user = data?.user;
            if (user?.id) {
              await new Promise((r) => setTimeout(r, 100));
              const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).single();
              if (existingProfile) user = existingProfile;
            }
          }
        } else {
          const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).single();
          user = profile;
        }

        if (!user?.id) {
          break;
        }

        // One-time PAYG credit purchase
        if (session.mode === "payment" && session.metadata?.payg_tier && session.metadata?.credits) {
          const credits = parseInt(session.metadata.credits, 10);
          const paygTier = session.metadata.payg_tier;
          if (!Number.isNaN(credits) && paygTier) {
            const result = await monkey.masterOfCoins.grantPayg(supabase, {
              userId: user.id,
              credits,
              paygTier,
              stripeEventId: event.id,
              sessionId: session.id,
            });
            if (!result.ok) {
            }
          }
          // Ensure profile has stripe_customer_id for future checkouts
          const { data: existing } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
          if (existing && !existing.stripe_customer_id) {
            const { error: updateError } = await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
            if (updateError) {
            }
          }
          break;
        }

        // Subscription checkout
        if (session.mode === "subscription") {
          if (!priceId) {
            break;
          }

          const tierId = resolveTierFromPriceId(priceId);
          if (!tierId) {
            break;
          }
          
          let subscription_renewal_at = null;
          let subscription_period_start_at = null;
          if (subscriptionId) {
            try {
              const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
              if (subscription.current_period_end) {
                subscription_renewal_at = new Date(subscription.current_period_end * 1000).toISOString();
              }
              if (subscription.current_period_start) {
                subscription_period_start_at = new Date(subscription.current_period_start * 1000).toISOString();
              }
            } catch (subErr) {
            }
          }

          const effective_credits_reset_at = subscription_renewal_at;
          const effective_period_start_at = subscription_period_start_at;

          const updatePayload = {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_plan: tierId,
            stripe_price_id: priceId,
          };
          if (effective_credits_reset_at) {
            updatePayload.credits_reset_at = effective_credits_reset_at;
          }
          if (effective_period_start_at) {
            updatePayload.subscription_period_start_at = effective_period_start_at;
          }
          if (effective_credits_reset_at || effective_period_start_at) {
            updatePayload.subscription_meta = {
              period_start: effective_period_start_at,
              period_end: effective_credits_reset_at,
              subscription_id: subscriptionId,
              price_id: priceId,
            };
          }

          const { error: updateError } = await supabase
            .from("profiles")
            .update(updatePayload)
            .eq("id", user.id);

          if (updateError) {
          } else {
            // Create subscription ledger row so Step 2 passes even if invoice.paid is delayed or fails
            try {
              const idempotencyKey = idempotencyKeyForNewSubscription(subscriptionId);
              const mocResult = await monkey.masterOfCoins.applyImmediateUpgrade(supabase, {
                profileId: user.id,
                fromPlan: "free",
                toPlan: tierId,
                period_start_at: effective_period_start_at,
                period_end_at: effective_credits_reset_at,
                now: new Date().toISOString(),
                idempotencyKey,
                subscriptionId,
              });
              if (!mocResult?.ok) {
              }
            } catch (mocErr) {
            }
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "checkout.session.expired":
      case "invoice.payment_failed": {
        await processWebhookEvent(supabase, event);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    if (monkey.diag.enabled()) {
      monkey.diag.log("error", "stripe webhook failed", { error_name: e?.name, stack: String(e?.stack || "").slice(0, 2000) }, { request_id: requestId, source: "webhook" });
    }
  }

  if (monkey.diag.enabled()) {
    await monkey.diag.flush({ request_id: requestId, source: "webhook" });
  }
  return NextResponse.json({});
}
