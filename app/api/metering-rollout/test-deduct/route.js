import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { deductCredits } from "@/libs/monkey/tools/metering";

/**
 * POST /api/metering-rollout/test-deduct
 * Test _deductCredits. Returns before/after monthly_credits_used.
 * Body: { credits? }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { credits = 1 } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: before } = await supabase
      .from("user_credits")
      .select("monthly_credits_used")
      .eq("user_id", user.id)
      .maybeSingle();

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    await deductCredits(user.id, parseFloat(credits) || 1, monkey._meteringAdapter());

    const { data: after } = await supabase
      .from("user_credits")
      .select("monthly_credits_used")
      .eq("user_id", user.id)
      .maybeSingle();

    const beforeVal = parseFloat(before?.monthly_credits_used) || 0;
    const afterVal = parseFloat(after?.monthly_credits_used) || 0;
    const incremented = Math.abs(afterVal - beforeVal - credits) < 0.001;

    return NextResponse.json({
      success: true,
      result: { before: beforeVal, after: afterVal, credits, incremented },
      executionFlow: [
        "POST /api/metering-rollout/test-deduct",
        "read user_credits (before)",
        "monkey._deductCredits(userId, credits)",
        "update user_credits",
        "read user_credits (after)",
        "return { before, after }",
      ],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Test failed", success: false }, { status: 500 });
  }
}
