import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/load-user-context
 * Body: { user_context: { userId, planContext } } (same shape client sends to other APIs).
 * Loads user_context into monkey and returns what monkey has (to verify server-side loading).
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;

    const body = await req.json().catch(() => ({}));

    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    const plan = monkey.planContext;
    const minimalPlan = plan
      ? {
          profile_id: plan.profile_id,
          subscription_plan: plan.subscription_plan,
          tier_name: plan.tier_name,
          has_access: plan.has_access,
          limits: plan.limits,
        }
      : null;

    return NextResponse.json({
      loaded: true,
      userId: monkey.user?.id ?? null,
      planContext: minimalPlan,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
