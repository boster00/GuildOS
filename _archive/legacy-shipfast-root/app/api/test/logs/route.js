import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

const N = 10;

/**
 * GET /api/test/logs
 * Returns last N rows from external_requests, stripe_webhook_events, credit_ledger; optional stale pending count.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const [extReq, stripeEvents, ledger, stalePending] = await Promise.all([
      supabase
        .from("external_requests")
        .select("id, profile_id, provider, operation, status, error_message, latency_ms, created_at, finished_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(N),
      supabase
        .from("stripe_webhook_events")
        .select("event_id, event_type, processed_at")
        .order("processed_at", { ascending: false })
        .limit(N),
      supabase
        .from("credit_ledger")
        .select("id, user_id, action, cost, created_at, idempotency_key")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(N),
      supabase
        .from("external_requests")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .eq("status", "pending")
        .lt("created_at", tenMinAgo),
    ]);

    const staleCount = stalePending.count ?? 0;

    return NextResponse.json({
      external_requests: extReq.data ?? [],
      stripe_webhook_events: stripeEvents.data ?? [],
      credit_ledger: ledger.data ?? [],
      stale_pending_count: staleCount,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
