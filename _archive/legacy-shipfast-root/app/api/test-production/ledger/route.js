import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-production/ledger
 * Returns the current user's last 20 credit_ledger rows (most recent first).
 * Session-bound: queries only auth.uid(). Never accepts userId param.
 * Auth required.
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
      .select("id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, monthly_balance, payg_balance, meta, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message, ledger: [] }, { status: 500 });
    }

    return NextResponse.json({ ledger: ledger ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err.message, ledger: [] }, { status: 500 });
  }
}
