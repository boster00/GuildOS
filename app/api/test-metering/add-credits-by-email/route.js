import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { meterGrant, meterSpend } from "@/libs/monkey/tools/metering";

/**
 * POST /api/test-metering/add-credits-by-email
 * Test-only: add or remove credits for a user looked up by email.
 * Body: { email: string, credits: number }. Positive = add (ledger cost negative), negative = remove (ledger cost positive).
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const rawCredits = typeof body.credits === "number" ? body.credits : 0;
    const credits = Math.floor(rawCredits);

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (credits === 0) {
      return NextResponse.json({ error: "credits must be non-zero (positive = add, negative = remove)" }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    const { data: profile, error: findError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
    }

    if (credits > 0) {
      const result = await meterGrant(admin, {
        userId: profile.id,
        action: "admin_add",
        creditAmount: credits,
        idempotencyKey: crypto.randomUUID(),
        meta: { credits_added: credits },
        target: "payg",
      });
      if (!result.ok) {
        return NextResponse.json({ error: "Grant failed" }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        email,
        creditsAdded: credits,
        creditsRemaining: result.remaining ?? 0,
      });
    }

    // credits < 0: remove from account (ledger cost positive)
    const cost = Math.abs(credits);
    const result = await meterSpend(admin, {
      userId: profile.id,
      action: "admin_deduct",
      cost,
      idempotencyKey: crypto.randomUUID(),
      meta: { credits_removed: cost },
    });
    if (!result.ok) {
      return NextResponse.json({
        error: result.code === "OUT_OF_CREDITS" ? "Insufficient credits" : "Deduct failed",
      }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      email,
      creditsRemoved: cost,
      creditsRemaining: result.remaining ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}
