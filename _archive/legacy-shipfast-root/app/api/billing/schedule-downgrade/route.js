import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/libs/supabase/server";
import { scheduleSubscriptionDowngrade, cancelSubscriptionAtPeriodEnd } from "@/libs/stripe.js";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";
import masterOfCoins from "@/libs/monkey/masterOfCoins/index.js";

/**
 * POST /api/billing/schedule-downgrade
 * Schedules a subscription downgrade to take effect at the next credits_reset_at boundary.
 * DB work order is written FIRST so the webhook guard is in place before Stripe fires.
 * Rolls back the work order if the Stripe call fails.
 *
 * Body: { toPlan: string }
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
    const { toPlan } = body;

    if (!toPlan) {
      return NextResponse.json({ error: "toPlan is required" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, subscription_plan, stripe_subscription_id, coins_work_order")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentTier = subscriptionTiers.getTierById(profile.subscription_plan || "free");
    const toTier = subscriptionTiers.getTierById(toPlan);

    if (!toTier) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    if ((toTier.monthlyPrice ?? 0) >= (currentTier.monthlyPrice ?? 0)) {
      return NextResponse.json({ error: "toPlan must be a lower-priced plan than current plan" }, { status: 400 });
    }
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: "No active Stripe subscription found" }, { status: 400 });
    }

    const isDowngradeToFree = toPlan === "free";

    // Resolve price ID for paid-to-paid downgrades (not needed when cancelling to free)
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";
    const priceId = isDowngradeToFree
      ? null
      : (isSandboxMode ? (toTier.stripePriceIdSandbox || toTier.stripePriceId) : toTier.stripePriceId);

    if (!isDowngradeToFree && !priceId) {
      return NextResponse.json({ error: "No Stripe price ID configured for this plan" }, { status: 400 });
    }

    // DB FIRST: write work order so the webhook guard is active before Stripe fires
    const downgradeResult = await masterOfCoins.scheduleDowngrade(supabase, {
      profileId: profile.id,
      toPlan,
      requested_at: new Date().toISOString(),
      source: "schedule-downgrade-api",
    });

    if (!downgradeResult.ok) {
      return NextResponse.json({ error: downgradeResult.error || "Failed to schedule downgrade" }, { status: 500 });
    }

    // THEN STRIPE: cancel at period end (free) or update subscription price (paid tier)
    try {
      if (isDowngradeToFree) {
        await cancelSubscriptionAtPeriodEnd({
          subscriptionId: profile.stripe_subscription_id,
          useSandbox: isSandboxMode,
        });
      } else {
        await scheduleSubscriptionDowngrade({
          subscriptionId: profile.stripe_subscription_id,
          newPriceId: priceId,
          useSandbox: isSandboxMode,
        });
      }
    } catch (stripeError) {
      // Rollback: clear pending_change from work order so the DB stays consistent
      try {
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select("coins_work_order")
          .eq("id", profile.id)
          .single();
        if (freshProfile) {
          const workOrder = { ...(freshProfile.coins_work_order || {}) };
          delete workOrder.pending_change;
          await supabase.from("profiles").update({ coins_work_order: workOrder }).eq("id", profile.id);
        }
      } catch (rollbackError) {
      }
      return NextResponse.json({ error: stripeError?.message || "Stripe update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
