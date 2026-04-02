import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { checkQuota } from "@/libs/monkey/tools/metering";
import { getAllTiers } from "@/libs/monkey";

/**
 * GET /api/healthz/metering
 * Health check for metering system: registry load, DB connection, and _checkQuota response time.
 */
export async function GET() {
  const start = Date.now();
  try {
    const tiers = getAllTiers();
    if (!tiers?.length) {
      return NextResponse.json({
        ok: false,
        error: "subscription tiers registry empty",
        duration: Date.now() - start,
      }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: credits, error: creditsError } = await supabase
      .from("user_credits")
      .select("user_id")
      .limit(1);
    if (creditsError) {
      return NextResponse.json({
        ok: false,
        error: "user_credits read failed",
        detail: creditsError.message,
        duration: Date.now() - start,
      }, { status: 503 });
    }

    const monkey = await initMonkey();
    const checkStart = Date.now();
    const quotaCheck = await checkQuota("00000000-0000-0000-0000-000000000000", 1, monkey._meteringAdapter());
    const checkDuration = Date.now() - checkStart;

    const ok = checkDuration < 2000;
    return NextResponse.json({
      ok,
      subscription_tiers_registry: tiers?.length ?? 0,
      user_credits_readable: true,
      checkQuota_duration_ms: checkDuration,
      total_duration_ms: Date.now() - start,
      quota_check_sample: quotaCheck?.allowed !== undefined,
    }, { status: ok ? 200 : 503 });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      duration: Date.now() - start,
    }, { status: 503 });
  }
}
