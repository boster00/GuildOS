import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";
import { provisionSubscription } from "@/libs/monkey/subscriptionProvisioner";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/replay-grant
 * Body: { stripeEventId?: string } (optional; if omitted, use last event from stripe_webhook_events)
 * Re-runs provisioner with same idempotency key to prove no double grant. Returns ledger count before/after and granted.
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const body = await req.json().catch(() => ({}));
    let eventId = body?.stripeEventId;

    if (!eventId) {
      const { data: lastRow } = await supabase
        .from("stripe_webhook_events")
        .select("event_id")
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      eventId = lastRow?.event_id ?? null;
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "No stripeEventId provided and no events in stripe_webhook_events" },
        { status: 400 }
      );
    }

    const { count: countBefore } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const plan = await getPlanContext(supabase, user.id);
    const tierId = plan?.subscription_plan ?? "free";

    const result = await provisionSubscription(supabase, {
      userId: user.id,
      tierId,
      source: "stripe",
      idempotencyKey: eventId,
    });

    const { count: countAfter } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { data: lastRows } = await supabase
      .from("credit_ledger")
      .select("id, action, cost, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      replayed: true,
      granted: result.granted,
      message: result.granted ? "New grant applied" : "Already processed (idempotent)",
      stripeEventId: eventId,
      ledger_count_before: countBefore ?? 0,
      ledger_count_after: countAfter ?? 0,
      last_5_ledger: lastRows ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
