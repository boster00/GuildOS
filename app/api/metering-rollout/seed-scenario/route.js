import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

const SCENARIOS = {
  "1.1": { subscription_plan: "free", monthly_credits_used: 50, monthly_usage_reset_at: null },
  "1.2": { subscription_plan: "free", monthly_credits_used: 98, monthly_usage_reset_at: null }, // 98+15=113 > 110 grace
  "1.3": { subscription_plan: "free", monthly_credits_used: 105, monthly_usage_reset_at: null },
  "1.4": { subscription_plan: "free", monthly_credits_used: 112, monthly_usage_reset_at: null },
  "1.5": { subscription_plan: "pro", monthly_credits_used: 5000, monthly_usage_reset_at: null },
  "1.6": { subscription_plan: "free", monthly_credits_used: 98, override_quota: true },
  "1.7": { subscription_plan: "free", monthly_credits_used: 95, monthly_usage_reset_at: "yesterday" },
  "5.3": { subscription_plan: "free", monthly_credits_used: 10, trial_ends_at: "yesterday" },
};

function getNextMonthReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

/**
 * POST /api/metering-rollout/seed-scenario
 * Set up current user's credits/tier for a test scenario.
 * Body: { scenario: "1.1" | "1.2" | ... }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scenario } = body;

    if (!scenario || !SCENARIOS[scenario]) {
      return NextResponse.json({ error: "Invalid scenario", valid: Object.keys(SCENARIOS) }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = SCENARIOS[scenario];
    const resetAt = config.monthly_usage_reset_at === "yesterday"
      ? new Date(Date.now() - 86400000).toISOString()
      : getNextMonthReset();

    await supabase
      .from("profiles")
      .update({ subscription_plan: config.subscription_plan || "free" })
      .eq("id", user.id);

    await supabase.from("user_credits").upsert({
      user_id: user.id,
      monthly_credits_used: config.monthly_credits_used ?? 0,
      monthly_usage_reset_at: config.monthly_usage_reset_at === "yesterday" ? resetAt : getNextMonthReset(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({
      success: true,
      scenario,
      userId: user.id,
      config: { ...config, monthly_usage_reset_at: config.monthly_usage_reset_at === "yesterday" ? "yesterday" : getNextMonthReset() },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Seed failed", success: false }, { status: 500 });
  }
}
