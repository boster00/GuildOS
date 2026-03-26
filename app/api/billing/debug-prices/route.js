import { NextResponse } from "next/server";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

/**
 * GET /api/billing/debug-prices
 * Debug endpoint to verify price IDs are configured correctly.
 * Shows both regular and sandbox price IDs.
 * ONLY works in development mode.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { TIERS } = subscriptionTiers;

  const priceConfig = TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    regularPriceId: tier.stripePriceId,
    sandboxPriceId: tier.stripePriceIdSandbox,
    hasSandboxPrice: !!tier.stripePriceIdSandbox,
  }));

  const envVars = {
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER || null,
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || null,
    STRIPE_PRICE_TEST: process.env.STRIPE_PRICE_TEST || null,
    STRIPE_PRICE_STARTER_SANDBOX_TEST: process.env.STRIPE_PRICE_STARTER_SANDBOX_TEST || null,
    STRIPE_PRICE_PRO_SANDBOX_TEST: process.env.STRIPE_PRICE_PRO_SANDBOX_TEST || null,
    STRIPE_PRICE_STARTER_PAYG: process.env.STRIPE_PRICE_STARTER_PAYG || null,
    STRIPE_PRICE_PRO_PAYG: process.env.STRIPE_PRICE_PRO_PAYG || null,
    STRIPE_PRICE_STARTER_PAYG_SANDBOX_TEST: process.env.STRIPE_PRICE_STARTER_PAYG_SANDBOX_TEST || null,
    STRIPE_PRICE_PRO_PAYG_SANDBOX_TEST: process.env.STRIPE_PRICE_PRO_PAYG_SANDBOX_TEST || null,
  };

  return NextResponse.json({
    message: "Price ID configuration (dev only)",
    tiers: priceConfig,
    envVars,
    keysConfigured: {
      hasRegularKeys: !!process.env.STRIPE_SECRET_KEY,
      hasSandboxKeys: !!process.env.STRIPE_SECRET_SANDBOX_TEST_KEY,
    },
  });
}
