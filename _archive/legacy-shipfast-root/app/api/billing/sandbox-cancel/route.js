import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { cancelSubscription } from "@/libs/monkey/subscriptionProvisioner";
import { requireDevRouteAuth, getDevRouteBlockResponse } from "@/libs/testStripeGuard";

/**
 * Dev-only route: block all methods in production (404); in non-prod require isTestStripeAllowed.
 */
export async function GET() {
  const block = getDevRouteBlockResponse();
  if (block) return block;
  return NextResponse.json(null, { status: 404 });
}

/**
 * POST /api/billing/sandbox-cancel
 * Sets subscription_plan to 'free'; uses same cancel path as Stripe webhook.
 * Blocked in production (404); in non-prod requires isTestStripeAllowed.
 */
export async function POST() {
  const supabase = await createClient();
  const guard = await requireDevRouteAuth(supabase);
  if (guard.response) return guard.response;
  const { user } = guard;

  try {
    await cancelSubscription(supabase, { userId: user.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Cancel failed" },
      { status: 500 }
    );
  }
}
