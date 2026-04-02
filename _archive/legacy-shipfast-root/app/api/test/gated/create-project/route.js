import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext, assertPlan, PlanAssertionError } from "@/libs/monkey";
import { getProjects } from "@/libs/visibility_tracker/db";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * POST /api/test/gated/create-project
 * Test-only: runs assertPlan(plan, 'projects.create', { currentProjectCount }). No real project creation.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const guard = await requireTestStripeAuth(supabase);
    if (guard.response) return guard.response;
    const { user } = guard;

    const plan = await getPlanContext(supabase, user.id);
    const { data: projects } = await getProjects(supabase, user.id);
    const currentProjectCount = Array.isArray(projects) ? projects.length : 0;

    try {
      assertPlan(plan, "projects.create", { currentProjectCount });
      return NextResponse.json({ allowed: true, reason: "ok", currentProjectCount });
    } catch (err) {
      const status = err instanceof PlanAssertionError ? err.status : 403;
      return NextResponse.json(
        { allowed: false, reason: err?.message ?? "Limit exceeded", currentProjectCount },
        { status }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
