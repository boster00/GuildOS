import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { RULES } from "@/libs/monkey/masterOfCoins/tools/rulesRegistry.js";

/**
 * POST /api/master-of-coins
 * Single endpoint for Master of Coins. Modes: immediate, reset, schedule_downgrade, payg_purchase, sandbox_grant.
 * Auth: CRON_SECRET or MASTER_OF_COINS_SECRET (Bearer or x-master-of-coins-secret).
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

    const body = await request.json().catch(() => ({}));
    const mode = body.mode;

    if (!mode) {
      return NextResponse.json(
        { error: "Missing mode (immediate | reset | schedule_downgrade | payg_purchase | sandbox_grant)" },
        { status: 400 }
      );
    }

    const rule = RULES[mode];
    if (!rule) {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}` },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const logs = [];
    const log = (msg) => logs.push(msg);

    // Reset has special batch logic when profileId is missing (worker mode)
    if (mode === "reset" && body.profileId == null) {
      const now = new Date().toISOString();

      const { data: profiles, error: fetchError } = await supabase
        .from("profiles")
        .select("id, email, subscription_plan, credits_reset_at")
        .not("credits_reset_at", "is", null)
        .lte("credits_reset_at", now);

      if (fetchError) {
        return NextResponse.json(
          { ok: false, error: fetchError.message },
          { status: 500 }
        );
      }

      const profileCount = (profiles || []).length;

      if (profileCount === 0) {
        return NextResponse.json({
          ok: true,
          granted: 0,
          processed: 0,
          results: [],
          logs,
        });
      }

      let granted = 0;
      const results = [];
      for (const p of profiles || []) {
        const result = await rule.handler(supabase, { profileId: p.id }, log);
        results.push({ profileId: p.id, email: p.email, ...result });
        if (result.ok && !result.skipped) granted++;
      }

      return NextResponse.json({
        ok: true,
        granted,
        processed: profileCount,
        results,
        logs,
      });
    }

    // Validate required fields for this mode
    const missing = rule.requiredFields.filter((f) => body[f] == null);
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await rule.handler(supabase, body, log);
    return NextResponse.json(mode === "reset" ? { ...result, logs } : result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
