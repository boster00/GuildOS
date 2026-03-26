import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-production/account-report
 * Returns a full account snapshot + step evaluations for the guided test page.
 * Auth required. Uses service role for cron_run_log (RLS allows only service_role).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false }, realtime: { disabled: true } }
  );

  const snapshot_fetched_at = new Date().toISOString();

  // ── Profile ──────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_plan, credits_remaining, credits_reset_at, payg_wallet, stripe_subscription_id, stripe_customer_id, coins_work_order, email, id"
    )
    .eq("id", user.id)
    .single();

  // ── Ledger ───────────────────────────────────────────────────────────────
  const { data: ledger } = await supabase
    .from("credit_ledger")
    .select(
      "id, action, cost, monthly_cost, payg_cost, monthly_balance, payg_balance, meta, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // ── Stripe events ────────────────────────────────────────────────────────
  // Primary: filter by user_id. If < 5 rows, also try by stripe_customer_id.
  let { data: stripeEvents } = await supabase
    .from("stripe_webhook_events")
    .select(
      "event_id, event_type, stripe_created_at, livemode, stripe_customer_id, stripe_subscription_id, stripe_invoice_id, processed_at, event_data"
    )
    .eq("user_id", user.id)
    .order("processed_at", { ascending: false })
    .limit(30);

  if ((stripeEvents ?? []).length < 5 && profile?.stripe_customer_id) {
    const { data: byCustomer } = await supabase
      .from("stripe_webhook_events")
      .select(
        "event_id, event_type, stripe_created_at, livemode, stripe_customer_id, stripe_subscription_id, stripe_invoice_id, processed_at, event_data"
      )
      .eq("stripe_customer_id", profile.stripe_customer_id)
      .order("processed_at", { ascending: false })
      .limit(30);
    if (byCustomer?.length) {
      // Merge, deduplicate by event_id, keep newest-first
      const merged = [
        ...(stripeEvents ?? []),
        ...byCustomer.filter(
          (e) => !(stripeEvents ?? []).some((s) => s.event_id === e.event_id)
        ),
      ];
      merged.sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));
      stripeEvents = merged.slice(0, 30);
    }
  }

  // ── Cron logs ────────────────────────────────────────────────────────────
  const { data: cronLogs } = await serviceSupabase
    .from("cron_run_log")
    .select("id, job_name, ran_at, status, user_id, meta")
    .or(`user_id.eq.${user.id},and(user_id.is.null,job_name.eq.credit_reset)`)
    .order("ran_at", { ascending: false })
    .limit(30);

  // ── Checkout safety ──────────────────────────────────────────────────────
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  let blocked, keyReason;
  if (key.startsWith("sk_live_")) {
    blocked = true;
    keyReason = "live key configured (safe)";
  } else if (key.startsWith("sk_test_")) {
    blocked = true;
    keyReason = "WARNING: test key in production";
  } else {
    blocked = false;
    keyReason = "missing or unrecognised key";
  }
  const hasSandboxPrices = subscriptionTiers.TIERS.some((t) => t.stripePriceIdSandbox != null);
  const checkoutSafety = { blocked, keyReason, hasSandboxPrices };

  // ── Step evaluator ───────────────────────────────────────────────────────
  const steps = evaluateSteps(profile, ledger ?? [], stripeEvents ?? [], cronLogs ?? []);

  return NextResponse.json({
    snapshot_fetched_at,
    profile: profile ?? null,
    ledger: ledger ?? [],
    stripeEvents: stripeEvents ?? [],
    cronLogs: cronLogs ?? [],
    checkoutSafety,
    steps,
  });
}

// ─── Evaluator ──────────────────────────────────────────────────────────────

function step(status, reasons, evidence = {}) {
  return { status, reasons, evidence };
}

function evaluateSteps(profile, ledger, events, cronLogs) {
  const now = Date.now();

  // ── Step 1: Register Free Account ───────────────────────────────────────
  function evalStep1() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];
    let status = "PASS";

    if (profile.credits_remaining !== 50) {
      reasons.push(`credits_remaining = ${profile.credits_remaining} (expected 50)`);
      status = "FAIL";
    }

    const grantRow = ledger.find((r) => r.action === "signup_bonus");
    if (!grantRow) {
      reasons.push("No signup_bonus ledger row found");
      if (status === "PASS") status = "WARN";
    } else {
      if (grantRow.cost !== -50) {
        reasons.push(`signup_bonus cost = ${grantRow.cost} (expected -50)`);
        if (status === "PASS") status = "WARN";
      }
      const flagText = JSON.stringify(grantRow.meta ?? "");
      if (!flagText.toLowerCase().includes("signup")) {
        reasons.push("signup_bonus meta does not contain 'signup' label");
        if (status === "PASS") status = "WARN";
      }
    }

    if (status === "PASS") reasons.push("credits_remaining = 50, signup_bonus in ledger");
    return step(status, reasons, { grantRow });
  }

  // ── Step 2: Subscribe to Test Plan ──────────────────────────────────────
  function evalStep2() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];
    let status = "PASS";

    if (profile.subscription_plan !== "test") {
      reasons.push(`subscription_plan = "${profile.subscription_plan}" (expected "test")`);
      status = "FAIL";
    }
    if (!profile.stripe_subscription_id) {
      reasons.push("stripe_subscription_id is not set");
      status = "FAIL";
    }

    if (profile.credits_reset_at) {
      const resetMs = new Date(profile.credits_reset_at).getTime();
      const diffMin = (resetMs - now) / 60000;
      if (diffMin < -2 || diffMin > 20) {
        reasons.push(`credits_reset_at is ${diffMin.toFixed(1)} min away (expected ~10 min ahead)`);
        if (status === "PASS") status = "WARN";
      }
    } else {
      reasons.push("credits_reset_at not set");
      if (status === "PASS") status = "WARN";
    }

    const subActions = ["subscription_upgrade_prorated", "subscription_start", "subscription_set"];
    const subRow = ledger.find((r) => subActions.some((a) => r.action?.startsWith(a)));
    if (!subRow) {
      reasons.push("No subscription ledger row found (expected one of: " + subActions.join(", ") + ")");
      if (status === "PASS") status = "WARN";
    } else if (!subRow.meta?.proration_math?.formula) {
      reasons.push("Subscription ledger row missing meta.proration_math.formula");
      if (status === "PASS") status = "WARN";
    }

    const eventTypes = events.map((e) => e.event_type);
    if (!eventTypes.includes("checkout.session.completed")) {
      reasons.push("Missing checkout.session.completed event");
      if (status === "PASS") status = "WARN";
    }
    if (!eventTypes.includes("customer.subscription.updated") && !eventTypes.includes("customer.subscription.created")) {
      reasons.push("Missing customer.subscription.updated/created event");
      if (status === "PASS") status = "WARN";
    }
    if (!eventTypes.includes("invoice.paid")) {
      reasons.push("Missing invoice.paid event");
      if (status === "PASS") status = "WARN";
    }

    if (status === "PASS") reasons.push("subscription_plan=test, stripe_subscription_id set, events present");
    return step(status, reasons, { subRow });
  }

  // ── Step 3: Upgrade to Test2 ─────────────────────────────────────────────
  function evalStep3() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];
    let status = "PASS";

    if (profile.subscription_plan !== "test2") {
      reasons.push(`subscription_plan = "${profile.subscription_plan}" (expected "test2")`);
      status = "FAIL";
    }
    if (!profile.stripe_subscription_id) {
      reasons.push("stripe_subscription_id is not set");
      status = "FAIL";
    }

    // Find upgrade row newer than any initial subscription row
    const upgradeRow = ledger.find((r) => r.action === "subscription_upgrade_prorated");
    if (!upgradeRow) {
      reasons.push("No subscription_upgrade_prorated ledger row found");
      if (status === "PASS") status = "WARN";
    } else if (!upgradeRow.meta?.proration_math?.formula) {
      reasons.push("Upgrade ledger row missing meta.proration_math.formula");
      if (status === "PASS") status = "WARN";
    }

    const eventTypes = events.map((e) => e.event_type);
    if (!eventTypes.includes("customer.subscription.updated")) {
      reasons.push("Missing customer.subscription.updated event");
      if (status === "PASS") status = "WARN";
    }

    const invoiceEvent = events.find(
      (e) =>
        e.event_type === "invoice.paid" || e.event_type === "invoice.payment_succeeded"
    );
    if (!invoiceEvent) {
      reasons.push("Missing invoice.paid / invoice.payment_succeeded event");
      if (status === "PASS") status = "WARN";
    } else {
      const br = invoiceEvent.event_data?.object?.billing_reason;
      if (br && br !== "subscription_update") {
        reasons.push(`invoice billing_reason = "${br}" (expected "subscription_update")`);
        if (status === "PASS") status = "WARN";
      }
    }

    if (status === "PASS") reasons.push("subscription_plan=test2, upgrade ledger row with proration formula, events present");
    return step(status, reasons, { upgradeRow, invoiceEvent });
  }

  // ── Step 4: Cron Reset ───────────────────────────────────────────────────
  function evalStep4() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];
    let status = "PASS";

    const tier = subscriptionTiers.getTierById(profile.subscription_plan);
    const expectedCredits = tier?.monthlyCreditQuota ?? null;

    if (expectedCredits !== null && profile.credits_remaining !== expectedCredits) {
      reasons.push(
        `credits_remaining = ${profile.credits_remaining} (expected ${expectedCredits} for ${profile.subscription_plan})`
      );
      status = "FAIL";
    }

    if (profile.credits_reset_at) {
      const resetMs = new Date(profile.credits_reset_at).getTime();
      const diffMin = (resetMs - now) / 60000;
      if (diffMin < -2 || diffMin > 20) {
        reasons.push(`credits_reset_at is ${diffMin.toFixed(1)} min away (expected ~10 min ahead)`);
        if (status === "PASS") status = "WARN";
      }
    } else {
      reasons.push("credits_reset_at not set");
      if (status === "PASS") status = "WARN";
    }

    const grantRow = ledger.find((r) => r.action === "monthly_grant");
    if (!grantRow) {
      reasons.push("No monthly_grant ledger row found");
      if (status === "PASS") status = "WARN";
    } else if (expectedCredits !== null && grantRow.cost !== -expectedCredits) {
      reasons.push(`monthly_grant cost = ${grantRow.cost} (expected ${-expectedCredits})`);
      if (status === "PASS") status = "WARN";
    }

    const expireRow = ledger.find((r) => r.action === "monthly_expire");
    if (!expireRow) {
      reasons.push("No monthly_expire ledger row found (expected before monthly_grant)");
      if (status === "PASS") status = "WARN";
    }

    const cronEntry = cronLogs.find((c) => c.job_name === "credit_reset");
    if (!cronEntry) {
      reasons.push("No credit_reset entry in cron_run_log — cron may not have written logs yet");
      if (status === "PASS") status = "WARN";
    }

    if (status === "PASS") reasons.push(`credits_remaining = ${expectedCredits}, monthly_grant in ledger, cron log present`);
    return step(status, reasons, { grantRow, expireRow, cronEntry });
  }

  // ── Step 5: Downgrade Test2 → Test ──────────────────────────────────────
  function evalStep5() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];

    const workOrder = profile.coins_work_order;
    const pendingDowngrade =
      workOrder?.pending_change?.type === "downgrade" &&
      workOrder?.pending_change?.to_plan === "test";
    const alreadyApplied = profile.subscription_plan === "test";

    if (!alreadyApplied && !pendingDowngrade) {
      reasons.push(`subscription_plan = "${profile.subscription_plan}" — no pending downgrade in coins_work_order`);
      return step("FAIL", reasons);
    }

    if (pendingDowngrade && !alreadyApplied) {
      reasons.push("Downgrade is scheduled (coins_work_order has pending_change) but not yet applied — wait for next cron reset");

      // Still check for supporting events
      const eventTypes = events.map((e) => e.event_type);
      if (!eventTypes.includes("customer.subscription.updated")) {
        reasons.push("No customer.subscription.updated event yet (may arrive after Stripe processes)");
      }
      return step("WARN", reasons, { workOrder });
    }

    // Applied
    const eventTypes = events.map((e) => e.event_type);
    if (!eventTypes.includes("customer.subscription.updated")) {
      reasons.push("Missing customer.subscription.updated event");
    }
    const boundaryRow = ledger.find(
      (r) => r.action === "monthly_expire" || r.action?.includes("downgrade")
    );
    if (!boundaryRow) {
      reasons.push("No downgrade-boundary ledger row found");
    }

    if (reasons.length === 0) {
      reasons.push("Downgrade applied: subscription_plan=test, events and ledger present");
    }
    return step(reasons.some((r) => r.startsWith("Missing") || r.startsWith("No ")) ? "WARN" : "PASS", reasons, { workOrder, boundaryRow });
  }

  // ── Step 6: Buy PAYG Credits ─────────────────────────────────────────────
  function evalStep6() {
    if (!profile) return step("FAIL", ["No profile loaded"]);

    const plan = profile.subscription_plan;
    if (plan !== "test" && plan !== "test2") {
      return step("BLOCKED", [
        `PAYG 1-credit pack requires test or test2 plan (current: ${plan})`,
      ]);
    }

    const reasons = [];
    let status = "PASS";

    if (!profile.payg_wallet || profile.payg_wallet < 1) {
      reasons.push(`payg_wallet = ${profile.payg_wallet ?? 0} (expected ≥ 1)`);
      status = "FAIL";
    }

    const paygRow = ledger.find((r) => r.action === "payg_purchase");
    if (!paygRow) {
      reasons.push("No payg_purchase ledger row found");
      if (status === "PASS") status = "WARN";
    } else if (paygRow.cost !== -1) {
      reasons.push(`payg_purchase cost = ${paygRow.cost} (expected -1)`);
      if (status === "PASS") status = "WARN";
    }

    const paygEvent = events.find((e) => {
      if (e.event_type !== "checkout.session.completed") return false;
      const d = e.event_data?.object ?? e.event_data ?? {};
      return d.mode === "payment" && String(d.metadata?.credits ?? "") === "1";
    });
    if (!paygEvent) {
      reasons.push(
        "No checkout.session.completed event with mode=payment and metadata.credits=1"
      );
      if (status === "PASS") status = "WARN";
    }

    if (status === "PASS") reasons.push("payg_wallet ≥ 1, payg_purchase ledger row cost=-1, payment event present");
    return step(status, reasons, { paygRow, paygEvent });
  }

  // ── Step 7: Downgrade Test → Free ────────────────────────────────────────
  function evalStep7() {
    if (!profile) return step("FAIL", ["No profile loaded"]);
    const reasons = [];

    const workOrder = profile.coins_work_order;
    const pendingDowngradeToFree =
      workOrder?.pending_change?.type === "downgrade" &&
      workOrder?.pending_change?.to_plan === "free";
    const alreadyApplied = profile.subscription_plan === "free" && !profile.stripe_subscription_id;

    if (!alreadyApplied && !pendingDowngradeToFree) {
      const plan = profile.subscription_plan;
      if (plan !== "test" && plan !== "test2") {
        reasons.push(`subscription_plan = "${plan}" — step requires test or test2 before downgrading to free`);
        return step("BLOCKED", reasons);
      }
      reasons.push(`subscription_plan = "${plan}" — schedule downgrade to Free from /billing/subscriptions`);
      return step("FAIL", reasons);
    }

    if (pendingDowngradeToFree && !alreadyApplied) {
      reasons.push("Downgrade to Free is scheduled (coins_work_order has pending_change to free) but not yet applied — wait for period end, then Stripe fires customer.subscription.deleted");
      const eventTypes = events.map((e) => e.event_type);
      if (!eventTypes.includes("customer.subscription.updated")) {
        reasons.push("customer.subscription.updated (cancel_at_period_end) may not be in events yet");
      }
      return step("WARN", reasons, { workOrder });
    }

    // Applied: free plan, no Stripe subscription
    const deletedEvent = events.find((e) => e.event_type === "customer.subscription.deleted");
    if (!deletedEvent) {
      reasons.push("Missing customer.subscription.deleted event (expected when subscription ends)");
    }
    if (reasons.length === 0) {
      reasons.push("Downgrade to Free applied: subscription_plan=free, stripe_subscription_id cleared");
    }
    return step(reasons.length > 0 && reasons.some((r) => r.startsWith("Missing")) ? "WARN" : "PASS", reasons, { deletedEvent });
  }

  return {
    step1: evalStep1(),
    step2: evalStep2(),
    step3: evalStep3(),
    step4: evalStep4(),
    step5: evalStep5(),
    step6: evalStep6(),
    step7: evalStep7(),
  };
}
