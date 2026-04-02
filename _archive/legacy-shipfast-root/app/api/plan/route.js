import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getPlanContext } from "@/libs/monkey";

/**
 * GET /api/plan
 * Returns current user's PlanContext (tier, limits, subscription_status, stripe_customer_id, etc.).
 * Use this instead of querying profiles for subscription_plan or calling getTierById in client code.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const plan = await getPlanContext(supabase, user.id);
    if (!plan) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch plan" },
      { status: 500 }
    );
  }
}
