import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/libs/supabase/server";
import Stripe from "stripe";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

function getStripeSecretKey(useSandbox) {
  const secretKey =
    useSandbox && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      : process.env.STRIPE_SECRET_KEY;
  if (!secretKey || typeof secretKey !== "string" || !secretKey.startsWith("sk_")) {
    const varName = useSandbox ? "STRIPE_SECRET_SANDBOX_TEST_KEY" : "STRIPE_SECRET_KEY";
    throw new Error(`Stripe secret key not configured. Set ${varName} in your environment.`);
  }
  return secretKey;
}

/**
 * POST /api/billing/preview-upgrade
 * Returns a prorated invoice preview for upgrading to a higher-priced plan.
 * Does NOT modify the subscription — pure read.
 *
 * Body: { toPlan: string }
 * Response: { amountDue, currency, prorationDate, lines: [{ amount, description, proration }] }
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
      .select("id, subscription_plan, stripe_subscription_id, stripe_customer_id")
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

    const secretKey = getStripeSecretKey(isSandboxMode);
    const stripe = new Stripe(secretKey);

    // Retrieve the subscription to get the current subscription item ID.
    // createPreview requires item.id to replace (not add) the price.
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      return NextResponse.json({ error: "No subscription item found" }, { status: 400 });
    }

    // Snapshot the proration time now. This same value must be passed to
    // upgrade-subscription so the charge exactly matches what is shown here.
    const prorationDate = Math.floor(Date.now() / 1000);

    const preview = await stripe.invoices.createPreview({
      customer: profile.stripe_customer_id,
      subscription: profile.stripe_subscription_id,
      subscription_details: {
        items: [{ id: subscriptionItemId, price: priceId }],
        proration_date: prorationDate,
      },
    });

    // Filter to proration-only lines — these are the items always_invoice will charge
    // immediately. preview.amount_due also includes the next billing cycle's subscription
    // charge, which is NOT collected at upgrade time, so we cannot use it directly.
    const prorationLines = (preview.lines?.data ?? []).filter((l) => l.proration);
    const prorationTotal = prorationLines.reduce((sum, l) => sum + l.amount, 0);
    const lines = prorationLines.map((line) => ({
      amount: line.amount,
      description: line.description || "Proration",
      proration: true,
    }));

    return NextResponse.json({
      amountDue: Math.max(0, prorationTotal),  // integer cents; 0 if credits exceed charges
      currency: preview.currency,               // e.g. "usd"
      prorationDate,
      lines,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
