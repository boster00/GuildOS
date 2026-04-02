import { NextResponse } from "next/server";
import { getAllTiers } from "@/libs/monkey";

/**
 * GET /api/tiers
 * Returns subscription tier definitions from the monkey registry (id, name, monthlyCreditQuota).
 * Safe for client; does not include stripePriceId.
 */
export async function GET() {
  try {
    const tiers = getAllTiers({ includeStripePriceId: false });
    return NextResponse.json(tiers);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch tiers" },
      { status: 500 }
    );
  }
}
