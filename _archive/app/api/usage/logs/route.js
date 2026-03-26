// ARCHIVED: Original path was app/api/usage/logs/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/usage/logs
 * Returns current user's recent usage (debit rows from credit_ledger).
 * api_usage_logs is obsolete; usage is in credit_ledger via meterSpend.
 * Query: limit (default 50), offset (default 0)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { data: rows, error } = await supabase
      .from("credit_ledger")
      .select("seq, action, cost, meta, created_at")
      .eq("user_id", user.id)
      .gt("cost", 0)
      .order("seq", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to fetch logs" },
        { status: 500 }
      );
    }

    // Map to legacy shape for Usage History UI (api_provider, api_type, method, model, credits, cost_usd)
    const meta = (r) => r?.meta && typeof r.meta === "object" ? r.meta : {};
    const logs = (rows ?? []).map((r) => {
      const m = meta(r);
      const [api_provider, api_type] = (r.action && r.action.includes("/")) ? r.action.split("/", 2) : [r.action || "—", r.action || "—"];
      return {
        id: r.seq,
        api_provider: m.api_provider ?? api_provider,
        api_type: m.api_type ?? r.action ?? "—",
        method: m.method ?? "—",
        model: m.model ?? "—",
        credits: Number(r.cost) || 0,
        cost_usd: typeof m.cost_usd === "number" ? m.cost_usd : (m.cost_usd != null ? parseFloat(m.cost_usd) : 0),
        created_at: r.created_at,
      };
    });

    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json(
      { error: e.message ?? "Failed to fetch usage logs" },
      { status: 500 }
    );
  }
}
