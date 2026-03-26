import { createPaygCheckout, assertNoSandboxPricesInProd } from "@/libs/stripe";
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const PAYG_PACKAGES = [30, 50, 100, 200, 500];
const PAYG_TIERS = ["starter", "pro"];

/**
 * POST /api/stripe/create-payg-checkout
 * Body: { credits: number, tier: 'starter' | 'pro', successUrl, cancelUrl }
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { credits, tier, successUrl, cancelUrl } = body;

  if (
    typeof credits !== "number" ||
    !Number.isInteger(credits) ||
    !PAYG_PACKAGES.includes(credits)
  ) {
    return NextResponse.json(
      { error: "credits must be one of: 30, 50, 100, 200, 500" },
      { status: 400 }
    );
  }
  if (!PAYG_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: "tier must be one of: starter, pro" },
      { status: 400 }
    );
  }
  if (!successUrl || !cancelUrl) {
    return NextResponse.json(
      { error: "successUrl and cancelUrl are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if sandbox mode is enabled (only in dev)
  const cookieStore = await cookies();
  const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
  const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

  const priceId = isSandboxMode
    ? (tier === "starter"
        ? process.env.STRIPE_PRICE_STARTER_PAYG_SANDBOX_TEST
        : process.env.STRIPE_PRICE_PRO_PAYG_SANDBOX_TEST)
    : (tier === "starter"
        ? process.env.STRIPE_PRICE_STARTER_PAYG
        : process.env.STRIPE_PRICE_PRO_PAYG);

  if (!priceId) {
    return NextResponse.json(
      { error: "PAYG price not configured for this tier" },
      { status: 500 }
    );
  }

  const sandboxBlock = assertNoSandboxPricesInProd(priceId);
  if (sandboxBlock) return sandboxBlock;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, stripe_customer_id, subscription_plan")
    .eq("id", user.id)
    .single();

  // Strictly enforce that the requested tier matches the user's actual plan.
  // Prevents a non-test user from crafting a request to access the 1-credit test pack.
  if (tier !== profile?.subscription_plan) {
    return NextResponse.json(
      { error: "Requested tier does not match your current subscription plan" },
      { status: 403 }
    );
  }

  try {
    const url = await createPaygCheckout({
      priceId,
      quantity: credits,
      metadata: {
        payg_tier: tier,
        credits: String(credits),
      },
      successUrl,
      cancelUrl,
      clientReferenceId: user.id,
      user: {
        email: profile?.email,
        customerId: profile?.stripe_customer_id,
      },
      useSandbox: isSandboxMode,
    });

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Checkout creation failed" },
      { status: 500 }
    );
  }
}
