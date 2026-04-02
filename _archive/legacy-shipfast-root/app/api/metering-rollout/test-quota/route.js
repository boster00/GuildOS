import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { checkQuota } from "@/libs/monkey/tools/metering";

/**
 * POST /api/metering-rollout/test-quota
 * Test quota check without making real API calls.
 * Body: { userId?, credits } - if no userId, uses current user
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId: bodyUserId, credits: requiredCredits = 5 } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = bodyUserId || user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "userId required. Pass in body or be logged in." },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const quotaCheck = await checkQuota(userId, parseFloat(requiredCredits) || 5, monkey._meteringAdapter());

    return NextResponse.json({
      success: true,
      result: quotaCheck,
      executionFlow: [
        "POST /api/metering-rollout/test-quota",
        "createClient()",
        "getUser()",
        "initMonkey()",
        "checkQuota(userId, credits, monkey._meteringAdapter())",
        "  -> read('profiles')",
        "  -> registry getTierById(tierId)",
        "  -> read('user_credits')",
        "return { allowed, reason?, used?, quota? }",
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message ?? "Test failed", success: false },
      { status: 500 }
    );
  }
}
