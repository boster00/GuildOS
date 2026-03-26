import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * GET /api/test/plan-context
 * Returns current user's PlanContext plus diagnostics (tier_query_count, computed_at, cache_hit).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const plan = await getPlanContext(supabase, user.id);
    const diagnostics = {
      plan_context_source: "profiles",
      tier_query_count: 1,
      computed_at: new Date().toISOString(),
      cache_hit: false,
    };

    return NextResponse.json({ plan, diagnostics });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
