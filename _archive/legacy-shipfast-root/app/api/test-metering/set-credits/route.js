import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { meterGrant, meterSpend } from "@/libs/monkey/tools/metering";

/**
 * POST /api/test-metering/set-credits
 * Test-only: update current user credits. Body: { credits: number }.
 * Positive: add credits (ledger admin_add). Negative: remove credits (ledger admin_deduct via meterSpend).
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = typeof body.credits === "number" ? body.credits : 10;
    const credits = Math.floor(raw);
    if (credits === 0) {
      // No-op: return combined balance (monthly + payg)
      const { data: profile } = await supabase.from("profiles").select("credits_remaining, payg_wallet").eq("id", user.id).single();
      const combined = (profile?.credits_remaining ?? 0) + (profile?.payg_wallet ?? 0);
      return NextResponse.json({ creditsRemaining: combined });
    }
    if (credits > 0) {
      const result = await meterGrant(supabase, {
        userId: user.id,
        action: "admin_add",
        creditAmount: credits,
        idempotencyKey: crypto.randomUUID(),
        meta: { credits_added: credits },
        target: "payg",
      });
      if (!result.ok) {
        return NextResponse.json({ error: "Grant failed" }, { status: 500 });
      }
      return NextResponse.json({ creditsRemaining: result.remaining ?? 0 });
    }
    // credits < 0: remove from account
    const cost = Math.abs(credits);
    const result = await meterSpend(supabase, {
      userId: user.id,
      action: "admin_deduct",
      cost,
      idempotencyKey: crypto.randomUUID(),
      meta: { credits_removed: cost },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.code === "OUT_OF_CREDITS" ? "Insufficient credits" : "Deduct failed" }, { status: 400 });
    }
    return NextResponse.json({ creditsRemaining: result.remaining ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}
