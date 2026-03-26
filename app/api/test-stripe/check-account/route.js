import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { getDevRouteBlockResponse } from "@/libs/testStripeGuard";

export async function GET() {
  const block = getDevRouteBlockResponse();
  if (block) return block;

  try {
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

    const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
      : process.env.STRIPE_SECRET_KEY;

    const stripe = new Stripe(secretKey);
    const account = await stripe.accounts.retrieve();

    return NextResponse.json({
      appAccount: {
        id: account.id,
        email: account.email,
        displayName: account.settings?.dashboard?.display_name
      },
      isSandboxMode,
      keyUsed: secretKey?.substring(0, 20) + "...",
      stripeCliAccount: "Check with: stripe config --list | findstr account_id",
      expectedCliAccount: account.id,
      diagnosis: "If Stripe CLI account_id does NOT match appAccount.id above, webhooks will never fire"
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      diagnosis: "Failed to retrieve account - check your Stripe keys"
    }, { status: 500 });
  }
}
