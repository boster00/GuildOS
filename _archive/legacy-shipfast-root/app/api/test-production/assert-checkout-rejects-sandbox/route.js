import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

/**
 * POST /api/test-production/assert-checkout-rejects-sandbox
 * Verifies that the production environment is correctly guarded against sandbox Stripe prices.
 *
 * Primary gate: STRIPE_SECRET_KEY prefix
 *   sk_live_ → blocked:true, keyReason:"live key configured (safe)"
 *   sk_test_ → blocked:true, keyReason:"WARNING: test key in production" (misconfiguration)
 *   else     → blocked:false, keyReason:"missing or unrecognised key"
 *
 * Secondary signal: hasSandboxPrices — whether any tier has stripePriceIdSandbox set.
 *   In production this must be false; if true it is a warning even if blocked.
 *
 * UI evaluates: blocked && !hasSandboxPrices → full PASS
 *               blocked &&  hasSandboxPrices → WARN (live key but sandbox prices configured)
 *               !blocked                     → FAIL
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" || process.env.ALLOW_TEST_PRODUCTION === "1";

  if (isProduction && !allowTestProduction) {
    return NextResponse.json(null, { status: 404 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  let blocked, keyReason;
  if (key.startsWith("sk_live_")) {
    blocked = true;
    keyReason = "live key configured (safe)";
  } else if (key.startsWith("sk_test_")) {
    blocked = true;
    keyReason = "WARNING: test key in production";
  } else {
    blocked = false;
    keyReason = "missing or unrecognised key";
  }

  const hasSandboxPrices = subscriptionTiers.TIERS.some(
    (t) => t.stripePriceIdSandbox != null
  );

  return NextResponse.json({
    blocked,
    keyReason,
    hasSandboxPrices,
    isProduction,
  });
}
