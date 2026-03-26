import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { provisionSubscriptionSandbox } from "@/libs/monkey/subscriptionProvisioner";
import { requireDevRouteAuth, getDevRouteBlockResponse } from "@/libs/testStripeGuard";

const ALLOWED_PLANS = ["test", "starter", "pro"];

/**
 * Dev-only route: block all methods in production (404); in non-prod require isTestStripeAllowed.
 */
export async function GET() {
  const block = getDevRouteBlockResponse();
  if (block) return block;
  return NextResponse.json(null, { status: 404 });
}

/**
 * POST /api/billing/sandbox-subscribe
 * Body: { plan: 'starter' | 'pro' }
 * Simulates successful subscription activation; uses same provisioner as Stripe webhook.
 * Blocked in production (404); in non-prod requires isTestStripeAllowed.
 */
export async function POST(request) {
  const supabase = await createClient();
  const guard = await requireDevRouteAuth(supabase);
  if (guard.response) return guard.response;
  const { user } = guard;

  try {
    const body = await request.json().catch(() => ({}));
    const plan = body?.plan;

    if (!plan || !ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan; must be 'test', 'starter', or 'pro'" },
        { status: 400 }
      );
    }

    const idempotencyKey = crypto.randomUUID();
    await provisionSubscriptionSandbox(supabase, {
      userId: user.id,
      tierId: plan,
      idempotencyKey,
    });

    return NextResponse.json({ success: true, plan });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Subscription failed" },
      { status: 500 }
    );
  }
}
