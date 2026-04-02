import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * GET /api/test/support-bundle
 * Returns safe JSON: profile summary (no secrets), planContext, last 10 ledger, external_requests, stripe_webhook_events.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const plan = await getPlanContext(supabase, user.id);

    const [profileRes, ledgerRes, extRes, stripeRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, subscription_plan, credits_remaining, payg_wallet, credits_reset_at, created_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("credit_ledger")
        .select("id, action, cost, created_at, idempotency_key")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("external_requests")
        .select("id, provider, operation, status, error_message, latency_ms, created_at, finished_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("stripe_webhook_events")
        .select("event_id, event_type, processed_at")
        .order("processed_at", { ascending: false })
        .limit(10),
    ]);

    const profile = profileRes.data;
    const profileSummary = profile
      ? {
          id: profile.id,
          email: profile.email,
          subscription_plan: profile.subscription_plan,
          subscription_status: "active",
          has_access: true,
          credits_remaining: profile.credits_remaining,
          payg_wallet: profile.payg_wallet,
          credits_reset_at: profile.credits_reset_at,
          created_at: profile.created_at,
        }
      : null;

    const bundle = {
      exported_at: new Date().toISOString(),
      profile_summary: profileSummary,
      planContext: plan,
      credit_ledger_last_10: ledgerRes.data ?? [],
      external_requests_last_10: extRes.data ?? [],
      stripe_webhook_events_last_10: stripeRes.data ?? [],
    };

    return NextResponse.json(bundle);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
