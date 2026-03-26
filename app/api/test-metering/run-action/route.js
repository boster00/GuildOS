import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { meterSpend, OutOfCreditsError } from "@/libs/monkey/tools/metering";
import { getCost } from "@/libs/monkey/tools/metering_costs";
import { randomUUID } from "crypto";
import { ACTIONS } from "./actions.js";

/**
 * POST /api/test-metering/run-action
 * Test runner: meterSpend then call existing API; return { ok, cost, remaining, result? } or 429 + cookie.
 * Body: { actionId: string } (optional overrides merged over defaultBody).
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const actionId = body.actionId;
    if (!actionId || !ACTIONS[actionId]) {
      return NextResponse.json(
        { error: "Invalid or missing actionId", allowed: Object.keys(ACTIONS) },
        { status: 400 }
      );
    }
    const config = ACTIONS[actionId];
    const cost = getCost(config.action);
    const idempotencyKey = randomUUID();
    const result = await meterSpend(supabase, {
      userId: user.id,
      action: config.action,
      cost,
      idempotencyKey,
      meta: { actionId },
    });
    if (!result.ok && result.code === "OUT_OF_CREDITS") {
      throw new OutOfCreditsError(result.remaining);
    }
    const base = request.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const cookie = request.headers.get("cookie") || "";
    const payload = { ...config.defaultBody, ...body };
    delete payload.actionId;
    const url = `${base}${config.path}`;
    const res = await fetch(url, {
      method: config.method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(payload),
    });
    const resultBody = await res.json().catch(() => ({ error: "Non-JSON response" }));
    return NextResponse.json({
      ok: true,
      cost,
      remaining: result.remaining,
      result: res.ok ? resultBody : { status: res.status, error: resultBody?.error || resultBody },
    });
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
