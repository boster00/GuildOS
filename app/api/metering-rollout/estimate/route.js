import { NextResponse } from "next/server";
import { getCreditCost } from "@/config/creditPricing";

/**
 * POST /api/metering-rollout/estimate
 * Get credit cost estimate from dictionary (no API call made).
 * Body: { actionType, params? }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { actionType = "AI_TEXT_SHORT", params = {} } = body;

    const credits = getCreditCost(actionType, params);

    return NextResponse.json({
      success: true,
      actionType,
      credits,
      executionFlow: [
        "POST /api/metering-rollout/estimate",
        "getCreditCost(actionType, params) from config/creditPricing.js",
        "CREDIT_COSTS[actionType]",
        "return { credits }",
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message ?? "Estimate failed", success: false },
      { status: 500 }
    );
  }
}
