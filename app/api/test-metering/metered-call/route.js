import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { meterSpend, OutOfCreditsError } from "@/libs/monkey/tools/metering";
import { getCost } from "@/libs/monkey/tools/metering_costs";

/**
 * POST /api/test-metering/metered-call
 * Test-only metered endpoint: getCost + meterSpend, returns { ok, remaining } or 429 + cookie.
 * Body: { action: string, idempotencyKey: string, meta?: object }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { action, idempotencyKey, meta } = body;
    if (!action || !idempotencyKey) {
      return NextResponse.json(
        { error: "Missing action or idempotencyKey" },
        { status: 400 }
      );
    }
    const cost = getCost(action);
    const result = await meterSpend(supabase, {
      userId: user.id,
      action,
      cost,
      idempotencyKey,
      meta: meta ?? null,
    });
    if (!result.ok && result.code === "OUT_OF_CREDITS") {
      throw new OutOfCreditsError(result.remaining);
    }
    return NextResponse.json({ ok: true, remaining: result.remaining });
  } catch (err) {
    if (err instanceof OutOfCreditsError) {
      const res = NextResponse.json(
        { error: "Out of credits", details: { remaining: err.remaining } },
        { status: 429 }
      );
      res.cookies.set("outofcredits", "true", { path: "/" });
      return res;
    }
    throw err;
  }
}
