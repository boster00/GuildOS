import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { meterSpend, meterGrant, meterReset } from "@/libs/monkey/tools/metering";
import { runCostRegistryChecks } from "@/libs/monkey/tools/metering_costs";
import { randomUUID } from "crypto";

/**
 * GET /api/test-metering
 * Runs cost registry checks. When authenticated, also returns creditsRemaining from profiles.
 */
export async function GET() {
  const result = runCostRegistryChecks();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_remaining, payg_wallet")
        .eq("id", user.id)
        .single();
      const combined = (profile?.credits_remaining ?? 0) + (profile?.payg_wallet ?? 0);
      return NextResponse.json({
        ...result,
        creditsRemaining: combined,
        paygWallet: profile?.payg_wallet ?? null,
      });
    }
  } catch {
    // ignore auth/DB errors; return cost registry only
  }
  return NextResponse.json(result);
}

/**
 * Step 4 (apiCall metering): add 1 credit to payg_wallet via ledger, call metered endpoint twice, assert first 200 second 429+cookie, DB 2 rows (grant + spend) and combined balance 0.
 */
async function runStep4Runner(request, supabase, userId, addLog) {
  const base = request.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const cookie = request.headers.get("cookie") || "";

  await meterReset(supabase, { userId });

  const grantResult = await meterGrant(supabase, {
    userId,
    action: "test_setup",
    creditAmount: 1,
    idempotencyKey: randomUUID(),
    meta: null,
    target: "payg",
  });
  if (!grantResult.ok || !grantResult.granted || grantResult.remaining !== 1) {
    addLog("Add 1 credit via ledger (payg_wallet)", "success", grantResult?.remaining ?? "error", false);
    return false;
  }
  addLog("Add 1 credit via ledger (payg_wallet)", "success", "granted, remaining 1", true);

  const keyA = randomUUID();
  const keyB = randomUUID();
  const url = `${base}/api/test-metering/metered-call`;

  const res1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "openai_text", idempotencyKey: keyA }),
  });
  const body1 = await res1.json().catch(() => ({}));
  const firstOk = res1.status === 200 && body1.ok === true && (body1.remaining === 0 || body1.remaining === null);
  addLog(
    "First metered call (openai_text, key A)",
    "200, ok: true, remaining 0",
    `${res1.status}, ok: ${body1.ok}, remaining: ${body1.remaining}`,
    firstOk
  );
  if (!firstOk) return false;

  const res2 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "openai_text", idempotencyKey: keyB }),
  });
  const setCookie = res2.headers.get("set-cookie") || "";
  const hasOutOfCreditsCookie = /outofcredits\s*=\s*true/i.test(setCookie);
  const body2 = await res2.json().catch(() => ({}));
  const secondFail = res2.status === 429 && hasOutOfCreditsCookie;
  addLog(
    "Second metered call (key B)",
    "429 + Set-Cookie outofcredits=true",
    `${res2.status}, cookie: ${hasOutOfCreditsCookie ? "set" : "not set"}`,
    secondFail
  );
  if (!secondFail) return false;

  const { count: ledgerCount } = await supabase
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { data: profile } = await supabase.from("profiles").select("credits_remaining, payg_wallet").eq("id", userId).single();
  const atLeastTwoRows = ledgerCount >= 2; // grant + spend (and possibly reset if balance was > 0)
  const combined = (profile?.credits_remaining ?? 0) + (profile?.payg_wallet ?? 0);
  const creditsZero = combined === 0;
  addLog("DB: credit_ledger rows", ">= 2 (grant + spend)", String(ledgerCount), atLeastTwoRows);
  addLog("DB: profiles combined balance", "0", String(combined), creditsZero);
  return atLeastTwoRows && creditsZero;
}

/**
 * POST /api/test-metering
 * Body.runStep4: run Step 4 (apiCall metering) verification.
 * Otherwise: runs the four meterSpend verification steps and returns structured logs.
 * Requires auth. Uses current user's profile and credit_ledger.
 */
export async function POST(request) {
  const logs = [];
  const addLog = (step, action, expected, actual, pass) => {
    logs.push({ step, action, expected, actual, pass });
  };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json().catch(() => ({}));
    if (body.runStep4 === true) {
      const step4AddLog = (action, expected, actual, pass) =>
        logs.push({ step: "Step4", action, expected, actual, pass });
      const allPass = await runStep4Runner(request, supabase, userId, step4AddLog);
      return NextResponse.json({ logs, allPass, step4: true });
    }

    // Step 1: Zero both pools via meter_reset, then add 10 credits to payg_wallet via ledger
    await meterReset(supabase, { userId });

    const step1Grant = await meterGrant(supabase, {
      userId,
      action: "test_setup",
      creditAmount: 10,
      idempotencyKey: randomUUID(),
      meta: null,
      target: "payg",
    });
    if (!step1Grant.ok || !step1Grant.granted || step1Grant.remaining !== 10) {
      addLog(1, "Add 10 credits via ledger", "success", step1Grant?.remaining ?? "error", false);
      return NextResponse.json({ logs, allPass: false });
    }
    addLog(1, "Add 10 credits via ledger", "success", "granted, remaining 10", true);

    const idempotencyKey1 = randomUUID();
    const idempotencyKey2 = randomUUID();

    // Ledger count before any spend (1 = the grant row)
    const { count: countBefore } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // Step 2: meterSpend cost=5 (first time)
    let result;
    try {
      result = await meterSpend(supabase, {
        userId,
        action: "test",
        cost: 5,
        idempotencyKey: idempotencyKey1,
        meta: null,
      });
    } catch (err) {
      addLog(2, "meterSpend(cost=5) first call", "ok: true, remaining: 5, charged: true", err.message, false);
      return NextResponse.json({ logs, allPass: false });
    }
    const { count: countAfter2 } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const ledgerIncreased = (countAfter2 ?? 0) === (countBefore ?? 0) + 1;
    const step2Pass =
      result.ok === true &&
      result.remaining === 5 &&
      result.charged === true &&
      ledgerIncreased;
    addLog(
      2,
      "meterSpend(cost=5) first call",
      "ok: true, remaining: 5, charged: true, ledger +1",
      JSON.stringify({ ok: result.ok, remaining: result.remaining, charged: result.charged, ledgerCount: countAfter2 }),
      step2Pass
    );

    // Step 3: same idempotencyKey again
    try {
      result = await meterSpend(supabase, {
        userId,
        action: "test",
        cost: 5,
        idempotencyKey: idempotencyKey1,
        meta: null,
      });
    } catch (err) {
      addLog(3, "meterSpend(same key) replay", "ok: true, charged: false, remaining: 5", err.message, false);
      return NextResponse.json({ logs, allPass: false });
    }
    const { count: countAfter3 } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const step3Pass =
      result.ok === true &&
      result.charged === false &&
      result.remaining === 5 &&
      countAfter3 === countAfter2;
    addLog(
      3,
      "meterSpend(same key) replay",
      "ok: true, charged: false, remaining: 5, ledger unchanged",
      JSON.stringify({ ok: result.ok, charged: result.charged, remaining: result.remaining, ledgerCount: countAfter3 }),
      step3Pass
    );

    // Step 4: new key, cost 6 (should fail OUT_OF_CREDITS)
    try {
      result = await meterSpend(supabase, {
        userId,
        action: "test",
        cost: 6,
        idempotencyKey: idempotencyKey2,
        meta: null,
      });
    } catch (err) {
      addLog(4, "meterSpend(new key, cost=6)", "ok: false, code: OUT_OF_CREDITS, remaining: 5", err.message, false);
      return NextResponse.json({ logs, allPass: false });
    }
    const { count: countAfter4 } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const step4Pass =
      result.ok === false &&
      result.code === "OUT_OF_CREDITS" &&
      result.remaining === 5 &&
      countAfter4 === countAfter3;
    addLog(
      4,
      "meterSpend(new key, cost=6)",
      "ok: false, code: OUT_OF_CREDITS, remaining: 5, no new ledger row",
      JSON.stringify({ ok: result.ok, code: result.code, remaining: result.remaining, ledgerCount: countAfter4 }),
      step4Pass
    );

    const allPass = step2Pass && step3Pass && step4Pass;
    return NextResponse.json({ logs, allPass });
  } catch (e) {
    logs.push({
      step: 0,
      action: "request",
      expected: "no error",
      actual: e.message ?? String(e),
      pass: false,
    });
    return NextResponse.json({ logs, allPass: false }, { status: 500 });
  }
}
