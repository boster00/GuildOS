// ARCHIVED: Original path was app/api/admin/credits/adjust/route.js

/**
 * @deprecated Use POST /api/admin/grant-payg instead.
 * This route writes directly to user_credits and bypasses the credit_ledger.
 * It is kept for reference only and should not be used from any new UI.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * POST /api/admin/credits/adjust
 * Admin: add or deduct credits for a user.
 * Body: { userId, amount } - amount positive = add, negative = deduct
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, amount } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminEmails = [
      ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
      ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) : []),
    ];
    const userEmail = (user.email || "").toLowerCase();
    if (adminEmails.length === 0 || !adminEmails.includes(userEmail)) {
      return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    if (!userId || typeof amount !== "number") {
      return NextResponse.json({ error: "userId and amount required" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("user_credits")
      .select("monthly_credits_used, credits_used")
      .eq("user_id", userId)
      .maybeSingle();

    const currentMonthly = parseFloat(row?.monthly_credits_used) || 0;
    const currentTotal = parseFloat(row?.credits_used) || 0;
    const newMonthly = Math.max(0, currentMonthly + amount);
    const newTotal = Math.max(0, currentTotal + amount);

    const { error } = await supabase
      .from("user_credits")
      .upsert({
        user_id: userId,
        monthly_credits_used: newMonthly,
        credits_used: newTotal,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      userId,
      amount,
      previousMonthly: currentMonthly,
      newMonthly,
      previousTotal: currentTotal,
      newTotal,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}
