import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext, assertPlan, PlanAssertionError } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/gated/start-external-request
 * Test-only: counts pending external_requests, runs assertPlan(plan, 'max_pending_external', { currentPending }).
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const plan = await getPlanContext(supabase, user.id);
    const { count, error: countError } = await supabase
      .from("external_requests")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "pending");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    const currentPending = typeof count === "number" ? count : 0;

    try {
      assertPlan(plan, "max_pending_external", { currentPending });
      return NextResponse.json({ allowed: true, reason: "ok", currentPending });
    } catch (err) {
      const status = err instanceof PlanAssertionError ? err.status : 429;
      return NextResponse.json(
        { allowed: false, reason: err?.message ?? "Too many active requests", currentPending },
        { status }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
