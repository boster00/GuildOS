import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext, assertPlan, PlanAssertionError } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/gated/run-scheduled
 * Test-only: returns allowed based on plan.limits.scheduledRuns (daily_weekly = allowed, monthly = not for "daily").
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const plan = await getPlanContext(supabase, user.id);
    const scheduledRuns = plan?.limits?.scheduledRuns ?? "monthly";

    try {
      assertPlan(plan, "scheduler.daily");
      return NextResponse.json({ allowed: true, scheduledRuns });
    } catch (err) {
      const status = err instanceof PlanAssertionError ? err.status : 403;
      return NextResponse.json(
        { allowed: false, reason: err?.message ?? "Plan does not include daily/weekly runs", scheduledRuns },
        { status }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
