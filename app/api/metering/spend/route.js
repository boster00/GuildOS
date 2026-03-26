import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey, getPlanContext, assertPlan, PlanAssertionError } from "@/libs/monkey";
import { meterSpend, OutOfCreditsError } from "@/libs/monkey/tools/metering";
import * as meteringCosts from "@/libs/monkey/tools/metering_costs";

/**
 * POST /api/metering/spend
 * Central metering endpoint: uses path (getCostByPath) or legacy action (getCost) + meterSpend.
 * Returns { ok, charged, remaining, externalRequestId? } or 429.
 * Body: { path?: string, action?: string, idempotencyKey: string, meta?: object } — path preferred; action legacy.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let plan = await getPlanContext(supabase, user.id);
    if (!plan) {
      plan = {
        profile_id: user.id,
        subscription_plan: "free",
        tier_name: "Free",
        has_access: true,
        subscription_status: "active",
        metering_enabled: true,
        limits: {
          maxPendingExternal: 1,
          monthlyCreditQuota: 50,
        },
      };
    }
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id, planContext: plan });
    const { path, action, idempotencyKey, meta } = body || {};

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Missing idempotencyKey" },
        { status: 400 }
      );
    }

    const identifier = path || action;
    if (!identifier) {
      return NextResponse.json(
        { error: "Missing path or action" },
        { status: 400 }
      );
    }

    const extMapping = path && typeof meteringCosts.getExternalRequestMapping === "function"
      ? meteringCosts.getExternalRequestMapping(path)
      : null;

    // Concurrency check: only for paths that create external_requests
    if (extMapping) {
      const plan = monkey.planContext;
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count, error: countErr } = await supabase
        .from("external_requests")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", monkey.user?.id ?? user.id)
        .eq("status", "pending")
        .gt("created_at", tenMinAgo);
      const currentPending = !countErr && count != null ? count : 0;
      try {
        assertPlan(plan, "max_pending_external", { currentPending });
      } catch (e) {
        if (e instanceof PlanAssertionError && e.status === 429) {
          return NextResponse.json(
            {
              error: e.message,
              code: "LIMIT_EXCEEDED",
              details: { currentPending, limit: plan?.limits?.maxPendingExternal ?? 1 },
            },
            { status: 429 }
          );
        }
        throw e;
      }
    }

    const cost = path ? meteringCosts.getCostByPath(path) : meteringCosts.getCost(action);
    const costNum = cost != null ? Number(cost) : null;
    const result = await meterSpend(supabase, {
      userId: monkey.user?.id ?? user.id,
      action: identifier,
      cost: costNum ?? cost,
      idempotencyKey,
      meta: meta ?? null,
    });

    if (!result.ok && result.code === "OUT_OF_CREDITS") {
      const res = NextResponse.json(
        {
          error: "Out of credits",
          code: "OUT_OF_CREDITS",
          details: { remaining: result.remaining ?? 0 },
        },
        { status: 429 }
      );
      res.cookies.set("outofcredits", "true", { path: "/" });
      return res;
    }

    let externalRequestId = null;
    if (extMapping && result.ledgerId) {
      const idempotencyStr = typeof idempotencyKey === "string" ? idempotencyKey : String(idempotencyKey);
      if (result.charged) {
        const { data: inserted, error: insertErr } = await supabase
          .from("external_requests")
          .insert({
            profile_id: monkey.user?.id ?? user.id,
            ledger_id: result.ledgerId,
            provider: extMapping.provider,
            operation: extMapping.operation,
            status: "pending",
            idempotency_key: idempotencyStr,
          })
          .select("id")
          .single();
        if (!insertErr && inserted?.id) externalRequestId = inserted.id;
      } else {
        const { data: existing } = await supabase
          .from("external_requests")
          .select("id")
          .eq("idempotency_key", idempotencyStr)
          .eq("profile_id", monkey.user?.id ?? user.id)
          .maybeSingle();
        if (existing?.id) externalRequestId = existing.id;
      }
    }

    return NextResponse.json({
      ok: true,
      charged: !!result.charged,
      remaining: result.remaining ?? null,
      ...(externalRequestId != null && { externalRequestId }),
    });
  } catch (err) {
    if (err instanceof OutOfCreditsError) {
      const res = NextResponse.json(
        {
          error: "Out of credits",
          code: "OUT_OF_CREDITS",
          details: { remaining: err.remaining },
        },
        { status: 429 }
      );
      res.cookies.set("outofcredits", "true", { path: "/" });
      return res;
    }

    const body = { error: "Failed to perform metering" };
    if (process.env.NODE_ENV === "development" && err && typeof err === "object") {
      if (err.message) body.detail = err.message;
      if (err.code) body.code = err.code;
    }
    return NextResponse.json(body, { status: 500 });
  }
}

