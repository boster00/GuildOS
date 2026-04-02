import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext, assertPlan, PlanAssertionError } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/assert-plan
 * Body: { featureKey, currentProjectCount?, currentPending? }
 * Returns { allowed, reason, plan } (plan = minimal snapshot).
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const body = await req.json().catch(() => ({}));
    const featureKey = body?.featureKey;
    if (!featureKey) {
      return NextResponse.json({ error: "featureKey required" }, { status: 400 });
    }

    const plan = await getPlanContext(supabase, user.id);
    const minimalPlan = plan
      ? {
          subscription_plan: plan.subscription_plan,
          tier_name: plan.tier_name,
          has_access: plan.has_access,
          limits: plan.limits,
        }
      : null;

    const opts = {};
    if (body.currentProjectCount != null) opts.currentProjectCount = body.currentProjectCount;
    if (body.currentPending != null) opts.currentPending = body.currentPending;

    try {
      assertPlan(plan, featureKey, opts);
      return NextResponse.json({
        allowed: true,
        reason: "ok",
        plan: minimalPlan,
      });
    } catch (err) {
      const isAssert = err instanceof PlanAssertionError;
      return NextResponse.json({
        allowed: false,
        reason: err?.message ?? "Plan assertion failed",
        plan: minimalPlan,
        status: isAssert ? err.status : 403,
      });
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
