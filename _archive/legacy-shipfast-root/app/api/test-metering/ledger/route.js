import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/test-metering/ledger
 * Returns the current user's recent credit_ledger rows (most recent first).
 * Requires auth.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", ledger: [] }, { status: 401 });
    }

    const { data: ledger, error } = await supabase
      .from("credit_ledger")
      .select("id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message, ledger: [] }, { status: 500 });
    }

    return NextResponse.json({ ledger: ledger ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err.message, ledger: [] }, { status: 500 });
  }
}
