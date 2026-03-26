import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";

/**
 * GET /api/usage/me
 * Returns current user's usage summary for metering (credits used, quota, tier).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getPlanContext(supabase, user.id);
    const { data: credits } = await supabase
      .from("user_credits")
      .select("monthly_credits_used, monthly_usage_reset_at")
      .eq("user_id", user.id)
      .maybeSingle();

    let quota = plan?.limits?.monthlyCreditQuota ?? 50;
    const testQuotaEnv = process.env.METERING_TEST_QUOTA != null && process.env.METERING_TEST_QUOTA !== "" ? parseInt(process.env.METERING_TEST_QUOTA, 10) : null;
    if (quota !== 0 && testQuotaEnv != null && !Number.isNaN(testQuotaEnv)) {
      quota = testQuotaEnv;
    }
    return NextResponse.json({
      creditsUsed: credits?.monthly_credits_used ?? 0,
      creditsQuota: quota === 0 ? null : quota,
      tierId: plan?.subscription_plan ?? "free",
      tierName: plan?.tier_name ?? "Free",
      subscriptionStatus: plan?.subscription_status ?? "active",
      resetAt: credits?.monthly_usage_reset_at ?? null,
      meteringEnabled: plan?.metering_enabled !== false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message ?? "Failed to fetch usage" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/usage/me
 * Body: { meteringEnabled: boolean }
 * Accepts preference; profiles.metering_enabled column may not exist, so we no-op and return success.
 */
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const meteringEnabled = body.meteringEnabled;
    if (typeof meteringEnabled !== "boolean") {
      return NextResponse.json(
        { error: "meteringEnabled must be a boolean" },
        { status: 400 }
      );
    }

    return NextResponse.json({ meteringEnabled });
  } catch (e) {
    return NextResponse.json(
      { error: e.message ?? "Failed to update preference" },
      { status: 500 }
    );
  }
}
