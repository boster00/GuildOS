import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/credits
 * Returns current user's credit balance (monthly + payg), reset date, and period usage (from ledger).
 * Response: { remaining: number, monthly_remaining: number, payg_wallet: number, reset_date: string | null, period_used: number }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { remaining: null, monthly_remaining: null, payg_wallet: null, reset_date: null, period_used: null },
        { status: 401 }
      );
    }

    // Get credits_remaining, payg_wallet, credits_reset_at from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining, payg_wallet, credits_reset_at")
      .eq("id", user.id)
      .single();

    // Prefer ledger-based reset date (profiles.credits_reset_at); fallback to user_credits
    let resetDate = profile?.credits_reset_at ?? null;
    if (resetDate == null) {
      try {
        const { data: userCredits } = await supabase
          .from("user_credits")
          .select("monthly_usage_reset_at")
          .eq("user_id", user.id)
          .single();
        if (userCredits?.monthly_usage_reset_at) {
          resetDate = userCredits.monthly_usage_reset_at;
        }
      } catch {
        // ignore
      }
    }

    // Period used: sum of total debit (cost or total_cost) in credit_ledger since reset
    let periodUsed = 0;
    try {
      let query = supabase
        .from("credit_ledger")
        .select("cost, total_cost")
        .eq("user_id", user.id)
        .gt("cost", 0);
      if (resetDate) {
        query = query.gte("created_at", resetDate);
      }
      const { data: rows } = await query;
      if (Array.isArray(rows)) {
        periodUsed = rows.reduce((sum, r) => sum + (Number(r.total_cost ?? r.cost) || 0), 0);
      }
    } catch {
      // ignore
    }

    const monthlyRemaining = profile?.credits_remaining ?? 0;
    const paygWallet = profile?.payg_wallet ?? 0;
    const remaining = monthlyRemaining + paygWallet;

    return NextResponse.json({
      remaining,
      monthly_remaining: monthlyRemaining,
      payg_wallet: paygWallet,
      reset_date: resetDate,
      period_used: periodUsed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch credits", remaining: null, monthly_remaining: null, payg_wallet: null, reset_date: null, period_used: null },
      { status: 500 }
    );
  }
}
