import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { logUsage } from "@/libs/monkey/tools/metering";

/**
 * POST /api/metering-rollout/test-log
 * Calls logUsage (no-op; api_usage_logs removed). Usage is recorded in credit_ledger via meterSpend.
 * Body: { credits?, apiProvider?, apiType?, method? }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { credits = 0.5, apiProvider = "openai", apiType = "openai_text", method = "test-log" } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const costUSD = credits * 0.10;
    await logUsage(user.id, apiProvider, apiType, {
      method,
      model: "gpt-4o-mini",
      prompt_tokens: 100,
      completion_tokens: 50,
    }, credits, costUSD, monkey._meteringAdapter());

    return NextResponse.json({
      success: true,
      result: { logged: true, note: "logUsage is a no-op; usage is in credit_ledger via meterSpend" },
      executionFlow: [
        "POST /api/metering-rollout/test-log",
        "logUsage(..., monkey._meteringAdapter()) — no-op (api_usage_logs removed)",
        "return { logged: true }",
      ],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Test failed", success: false }, { status: 500 });
  }
}
