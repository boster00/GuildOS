import { NextResponse } from "next/server";

/**
 * POST /api/master-of-coins/worker
 * Master of Coins worker: calls the single API once with mode=reset (no profileId).
 * The API endpoint loops server-side over all profiles due for reset.
 * No credit logic in this file; auth via CRON_SECRET or MASTER_OF_COINS_SECRET.
 */
export async function POST(request) {
  try {
    

    const authHeader = request.headers.get("authorization");
    const headerSecret = request.headers.get("x-master-of-coins-secret");
    const secret = authHeader?.replace(/^Bearer\s+/i, "").trim() || headerSecret;
    const expected =
      process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;

    if (!expected) {
      return NextResponse.json(
        { error: "Server misconfigured: MASTER_OF_COINS_SECRET or CRON_SECRET not set" },
        { status: 500 }
      );
    }
    if (secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const res = await fetch(`${origin}/api/master-of-coins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${expected}`,
      },
      body: JSON.stringify({ mode: "reset" }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `API returned ${res.status}`, success: false },
        { status: res.status }
      );
    }
    return NextResponse.json({
      success: true,
      granted: data.granted ?? 0,
      processed: data.processed ?? 0,
      logs: data.logs ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Worker failed", success: false },
      { status: 500 }
    );
  }
}
