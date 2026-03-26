import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import config from "@/config";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/billing/plans
 * Returns Stripe plans with price IDs for the subscription page.
 * If sandbox mode is enabled (dev only), returns sandbox test price IDs instead.
 * showTestPlans: true only when the logged-in user's email is in ADMIN_EMAIL / ADMIN_EMAILS.
 * Runs on the server so STRIPE_PRICE_* env vars are available; the client
 * cannot read them from config (they are not NEXT_PUBLIC_*).
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

    const adminEmails = [
      ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
      ...(process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        : []),
    ];
    let showTestPlans = false;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && adminEmails.length) {
      showTestPlans = adminEmails.includes((user.email || "").toLowerCase());
    }

    let plans = config.stripe?.plans ?? [];

    if (isSandboxMode) {
      const tiers = subscriptionTiers.TIERS;
      plans = plans.map((plan) => {
        const tier = tiers.find((t) => t.name === plan.name);
        if (tier?.stripePriceIdSandbox) {
          return { ...plan, priceId: tier.stripePriceIdSandbox };
        }
        return plan;
      });
    }

    return NextResponse.json({ plans, showTestPlans });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
