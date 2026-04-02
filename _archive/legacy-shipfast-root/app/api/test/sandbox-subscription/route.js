import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { provisionSubscriptionSandbox, cancelSubscription } from "@/libs/monkey/subscriptionProvisioner";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/sandbox-subscription
 * Body: { action: 'subscribe'|'cancel', tier: 'test'|'starter'|'pro' } (tier required for subscribe)
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) {
      return guard.response;
    }
    const { user } = guard;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const tier = body?.tier;
    if (action === "cancel") {
      await cancelSubscription(supabase, { userId: user.id });
      return NextResponse.json({ ok: true, action: "cancel" });
    }

    if (action === "subscribe") {
      if (!tier || !["test", "starter", "pro"].includes(tier)) {
        return NextResponse.json({ error: "tier must be 'test', 'starter', or 'pro'" }, { status: 400 });
      }
      const idempotencyKey = crypto.randomUUID();
      await provisionSubscriptionSandbox(supabase, {
        userId: user.id,
        tierId: tier,
        idempotencyKey,
      });
      return NextResponse.json({ ok: true, action: "subscribe", tier });
    }
    return NextResponse.json({ error: "action must be 'subscribe' or 'cancel'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
