import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { consumeCreditUpdated } from "@/libs/monkey/tools/metering";

/**
 * GET /api/credits/updated
 * Returns whether this user's credits were updated since last consume (e.g. by a meterSpend).
 * Consumes the flag so the frontend only refetches /api/credits when something changed.
 * Response: { updated: boolean }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ updated: false }, { status: 401 });
    }

    const updated = consumeCreditUpdated(user.id);
    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json({ updated: false }, { status: 500 });
  }
}
