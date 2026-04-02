import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * GET /api/test/state-snapshot
 * Returns profile (has_access, subscription_plan, subscription_status), credits, last_grant, planContext.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) {
      return guard.response;
    }
    const { user } = guard;
    const [profileRes, creditsRes, ledgerRes, ledgerCountRes, ledgerGrantCountRes, plan] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, subscription_plan, credits_remaining, payg_wallet, credits_reset_at, stripe_customer_id, stripe_subscription_id")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profiles")
        .select("credits_remaining, payg_wallet, credits_reset_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("credit_ledger")
        .select("id, action, cost, created_at")
        .eq("user_id", user.id)
        .lt("cost", 0)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r) => r.data),
      supabase
        .from("credit_ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("credit_ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lt("cost", 0),
      getPlanContext(supabase, user.id),
    ]);

    const profile = profileRes.data ?? null;
    const creditsRow = creditsRes.data ?? profile;
    const ledgerRows = ledgerRes ?? [];
    const ledgerCount = ledgerCountRes?.count ?? 0;
    const ledgerGrantCount = ledgerGrantCountRes?.count ?? 0;
    const lastGrant = ledgerRows[0]
      ? {
          amount: Math.abs(Number(ledgerRows[0].cost ?? 0)),
          grant_id: ledgerRows[0].id,
          created_at: ledgerRows[0].created_at,
          action: ledgerRows[0].action,
        }
      : null;
    const totalCredits = Number(creditsRow?.credits_remaining ?? 0) + Number(creditsRow?.payg_wallet ?? 0);

    const payload = {
      profile: profile
        ? {
            has_access: true,
            subscription_plan: profile.subscription_plan,
            subscription_status: "active",
            stripe_customer_id: profile.stripe_customer_id ?? null,
            stripe_subscription_id: profile.stripe_subscription_id ?? null,
            credits_reset_at: profile.credits_reset_at ?? null,
          }
        : null,
      credits: {
        credits_remaining: creditsRow?.credits_remaining ?? 0,
        payg_wallet: creditsRow?.payg_wallet ?? 0,
        total: totalCredits,
        credits_reset_at: creditsRow?.credits_reset_at ?? null,
      },
      ledgerCount,
      ledgerGrantCount,
      last_grant: lastGrant,
      recent_ledger_grants: ledgerRows.slice(0, 5).map((row) => ({
        id: row.id,
        action: row.action,
        cost: row.cost,
        created_at: row.created_at,
      })),
      planContext: plan,
    };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
