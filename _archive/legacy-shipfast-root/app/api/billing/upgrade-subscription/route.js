import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/libs/supabase/server";
import { upgradeSubscription } from "@/libs/stripe.js";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

/**
 * POST /api/billing/upgrade-subscription
 * Confirms a subscription upgrade after the user has reviewed the preview.
 * Uses always_invoice + pending_if_incomplete: Stripe immediately collects the
 * prorated invoice. If payment fails, the subscription stays unchanged and an
 * error is returned. Webhooks handle subscription_plan update and credit grant.
 *
 * Body: { toPlan: string, prorationDate: number (unix timestamp from preview) }
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { toPlan, prorationDate } = body;

    if (!toPlan) {
      return NextResponse.json({ error: "toPlan is required" }, { status: 400 });
    }

    // Validate prorationDate: must be a finite integer within the last 60 minutes.
    // Rejects stale previews and tampered payloads.
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      prorationDate == null ||
      !Number.isFinite(prorationDate) ||
      !Number.isInteger(prorationDate) ||
      prorationDate > nowSec ||
      prorationDate < nowSec - 3600
    ) {
      return NextResponse.json(
        { error: "prorationDate is missing, invalid, or too old. Please retry the upgrade." },
        { status: 400 }
      );
    }

    // Re-fetch profile at confirm time to guard against race conditions
    // (e.g. plan changed between preview and confirm in two browser tabs).
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, subscription_plan, stripe_subscription_id, subscription_meta")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: "no_subscription", message: "No active Stripe subscription — use Checkout for first-time subscriptions" },
        { status: 400 }
      );
    }

    // Re-validate tier rank server-side at confirm time.
    const currentTier = subscriptionTiers.getTierById(profile.subscription_plan || "free");
    const toTier = subscriptionTiers.getTierById(toPlan);

    if (!toTier) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    if ((toTier.monthlyPrice ?? 0) <= (currentTier.monthlyPrice ?? 0)) {
      return NextResponse.json({ error: "toPlan must be a higher-priced plan than current plan" }, { status: 400 });
    }

    // Resolve price ID (use sandbox price when sandbox mode is active)
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";
    const priceId = isSandboxMode
      ? (toTier.stripePriceIdSandbox || toTier.stripePriceId)
      : toTier.stripePriceId;

    if (!priceId) {
      return NextResponse.json({ error: "No Stripe price ID configured for this plan" }, { status: 400 });
    }

    // Generate idempotency key server-side — never trust the client to supply this.
    // Scoped to this specific user + subscription + target plan + proration snapshot,
    // so double-clicks or network retries within the same preview window are no-ops.
    const idempotencyKey = `upgrade-${user.id}-${profile.stripe_subscription_id}-${toPlan}-${prorationDate}`;

    // Store plan transition in subscription_meta BEFORE calling Stripe so that
    // webhook handlers (customer.subscription.updated, invoice.paid) can resolve
    // the correct from/to plans even when shared sandbox price IDs are in use or
    // when customer.subscription.updated fires before invoice.paid.
    const existingMeta = profile.subscription_meta || {};
    await supabase
      .from("profiles")
      .update({
        subscription_meta: {
          ...existingMeta,
          previous_plan: profile.subscription_plan,
          pending_plan: toPlan,
        },
      })
      .eq("id", user.id);
    try {
      await upgradeSubscription({
        subscriptionId: profile.stripe_subscription_id,
        newPriceId: priceId,
        prorationDate,
        idempotencyKey,
        useSandbox: isSandboxMode,
      });
    } catch (stripeError) {
      // Return structured error so the frontend can show appropriate copy
      // per Stripe error type without dismissing the modal.
      return NextResponse.json(
        {
          error: stripeError?.message || "Payment failed",
          stripeCode: stripeError?.code ?? null,    // e.g. "card_declined", "insufficient_funds"
          stripeType: stripeError?.type ?? null,     // e.g. "card_error", "invalid_request_error"
          retryable: stripeError?.type === "card_error",
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
