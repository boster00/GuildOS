import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";
import { processWebhookEvent } from "@/libs/stripe/processWebhookEvent.js";
import { createMockInvoicePaidEvent, createMockSubscriptionDeletedEvent } from "@/libs/stripe/mockEvents.js";
import {
  getScenarioEventConfig,
  getScenario,
  validateScenario,
  SCENARIOS,
  CORE_SCENARIO_KEYS,
  RECOMMENDED_SCENARIO_KEYS,
} from "@/libs/test/webhookScenarios.js";

/**
 * Get profile state and ledger count for the user (service role for reliable read).
 */
async function getStateForUser(supabase, userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, subscription_plan, credits_remaining, payg_wallet, credits_reset_at, stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .single();

  const { count: ledgerCount } = await supabase
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const credits = Number(profile?.credits_remaining ?? 0) + Number(profile?.payg_wallet ?? 0);
  return {
    profile: profile ?? null,
    credits,
    ledgerCount: ledgerCount ?? 0,
  };
}

/**
 * Ensure profile has stripe_customer_id and stripe_subscription_id for simulation (so invoice.paid can resolve user).
 */
async function ensureSimulationIds(supabase, userId) {
  const { data: profile, error: selectError } = await supabase
    .from("profiles")
    .select("id, stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (selectError) {
    throw new Error(`ensureSimulationIds: profile select failed: ${selectError.message}`);
  }
  if (!profile) {
    throw new Error("ensureSimulationIds: no profile row for user");
  }

  const customerId = profile.stripe_customer_id ?? `cus_sim_${userId.replace(/-/g, "")}`;
  const subscriptionId = profile.stripe_subscription_id ?? `sub_sim_${userId.replace(/-/g, "")}`;
  const needsUpdate = !profile.stripe_customer_id || !profile.stripe_subscription_id;

  if (needsUpdate) {
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", userId)
      .select("id, stripe_customer_id, stripe_subscription_id")
      .single();

    if (updateError) {
      throw new Error(`ensureSimulationIds: profile update failed: ${updateError.message}`);
    }
    if (!updated) {
      throw new Error("ensureSimulationIds: profile update matched no rows (profile missing?)");
    }
  }

  return { customerId, subscriptionId };
}

/**
 * GET /api/test/simulate-webhook
 * Returns list of scenario keys and labels for the test page.
 */
export async function GET() {
  try {
    const guardResponse = await (async () => {
      const supabase = await createClient();
      const guard = await requireTestStripeAuth(supabase);
      return guard.response;
    })();
    if (guardResponse) return guardResponse;

    const list = [
      ...CORE_SCENARIO_KEYS.map((key) => ({
        key,
        ...SCENARIOS[key],
        recommended: false,
      })),
      ...RECOMMENDED_SCENARIO_KEYS.map((key) => ({
        key,
        ...SCENARIOS[key],
        recommended: true,
      })),
    ].filter(Boolean);
    return NextResponse.json({ scenarios: list });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

/**
 * POST /api/test/simulate-webhook
 * Body: { scenarioKey: string, eventId?: string (for idempotency replay) }
 * Runs webhook logic for the scenario and returns state diff + validation.
 */
export async function POST(req) {
  try {
    const supabaseAuth = await createClient();
    const guard = await requireTestStripeAuth(supabaseAuth);
    if (guard.response) return guard.response;
    const { user } = guard;

    const supabase = createServiceRoleClient();
    const body = await req.json().catch(() => ({}));
    const scenarioKey = body?.scenarioKey;
    const replayEventId = body?.eventId ?? null;

    if (!scenarioKey) {
      return NextResponse.json({ error: "scenarioKey required" }, { status: 400 });
    }

    const scenario = getScenario(scenarioKey);
    if (!scenario) {
      return NextResponse.json({ error: `Unknown scenario: ${scenarioKey}` }, { status: 400 });
    }
    if (scenario.simulateNoOp && scenario.key !== "payment_failed") {
      return NextResponse.json({
        ok: true,
        scenario: scenarioKey,
        skipped: true,
        reason: "Scenario is no-op (e.g. checkout without invoice)",
        validations: [],
        passed: true,
      });
    }

    const { customerId, subscriptionId } = await ensureSimulationIds(supabase, user.id);
    const stateBefore = await getStateForUser(supabase, user.id);

    const eventConfig = getScenarioEventConfig(scenarioKey, {
      customerId,
      subscriptionId,
      userId: user.id,
    });

    if (!eventConfig && scenario.key === "payment_failed") {
      const mockEvent = {
        id: replayEventId ?? `evt_sim_payment_failed_${Date.now()}`,
        type: "invoice.payment_failed",
        data: { object: { customer: customerId } },
      };
      const { error: insertErr } = await supabase
        .from("stripe_webhook_events")
        .insert({ event_id: mockEvent.id, event_type: mockEvent.type });
      if (insertErr && insertErr.code !== "23505") {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      await processWebhookEvent(supabase, mockEvent);
      const stateAfter = await getStateForUser(supabase, user.id);
      const { validations, passed } = validateScenario(
        scenarioKey,
        stateBefore,
        stateAfter,
        { creditsGranted: 0, ledgerCreated: 0 }
      );
      return NextResponse.json({
        ok: true,
        scenario: scenarioKey,
        stateBefore: {
          profile: stateBefore.profile,
          credits: stateBefore.credits,
          ledgerCount: stateBefore.ledgerCount,
        },
        stateAfter: {
          profile: stateAfter.profile,
          credits: stateAfter.credits,
          ledgerCount: stateAfter.ledgerCount,
        },
        expectedOutcome: { plan: scenario.oldPlan, creditsGranted: 0, ledgerEntriesCreated: 0 },
        actualOutcome: {
          plan: stateAfter.profile?.subscription_plan,
          creditsGranted: 0,
          ledgerEntriesCreated: 0,
        },
        validations,
        passed,
      });
    }

    if (!eventConfig) {
      return NextResponse.json({
        error: `Scenario ${scenarioKey} has no event config (missing priceId?)`,
        scenario: scenarioKey,
      }, { status: 400 });
    }

    let event;
    if (eventConfig.eventType === "customer.subscription.deleted") {
      event = createMockSubscriptionDeletedEvent({
        eventId: replayEventId ?? eventConfig.eventParams.eventId,
        customerId: eventConfig.eventParams.customerId,
      });
    } else if (eventConfig.eventType === "invoice.paid") {
      event = createMockInvoicePaidEvent({
        ...eventConfig.eventParams,
        eventId: replayEventId ?? eventConfig.eventParams.eventId,
      });
    } else {
      return NextResponse.json({ error: `Unsupported event type: ${eventConfig.eventType}` }, { status: 400 });
    }

    const { error: insertError } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });
    if (insertError) {
      if (insertError.code === "23505") {
        const stateAfter = await getStateForUser(supabase, user.id);
        const creditsGranted = stateAfter.credits - stateBefore.credits;
        const ledgerCreated = stateAfter.ledgerCount - stateBefore.ledgerCount;
        const { validations, passed } = validateScenario(
          scenarioKey,
          stateBefore,
          stateAfter,
          { creditsGranted, ledgerCreated }
        );
        return NextResponse.json({
          ok: true,
          scenario: scenarioKey,
          idempotentReplay: true,
          eventId: event.id,
          stateBefore: { profile: stateBefore.profile, credits: stateBefore.credits, ledgerCount: stateBefore.ledgerCount },
          stateAfter: { profile: stateAfter.profile, credits: stateAfter.credits, ledgerCount: stateAfter.ledgerCount },
          actualOutcome: { creditsGranted, ledgerCreated },
          validations,
          passed,
        });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await processWebhookEvent(supabase, event);
    const stateAfter = await getStateForUser(supabase, user.id);
    const creditsGranted = stateAfter.credits - stateBefore.credits;
    const ledgerCreated = stateAfter.ledgerCount - stateBefore.ledgerCount;

    const expectedCredits =
      typeof scenario.expectedCreditsGranted === "function"
        ? scenario.expectedCreditsGranted()
        : scenario.expectedCreditsGranted ?? 0;

    const { validations, passed } = validateScenario(scenarioKey, stateBefore, stateAfter, {
      creditsGranted,
      ledgerCreated,
    });

    if (!passed) {
      const failed = validations.filter((v) => !v.passed);
      const stateSummary = {
        stateBefore: { plan: stateBefore.profile?.subscription_plan, credits: stateBefore.credits, ledgerCount: stateBefore.ledgerCount },
        stateAfter: { plan: stateAfter.profile?.subscription_plan, credits: stateAfter.credits, ledgerCount: stateAfter.ledgerCount },
      };
      
      failed.forEach((v) => {
        
      });
    }

    return NextResponse.json({
      ok: true,
      scenario: scenarioKey,
      eventId: event.id,
      stateBefore: {
        profile: stateBefore.profile,
        credits: stateBefore.credits,
        ledgerCount: stateBefore.ledgerCount,
      },
      stateAfter: {
        profile: stateAfter.profile,
        credits: stateAfter.credits,
        ledgerCount: stateAfter.ledgerCount,
      },
      expectedOutcome: {
        plan: scenario.expectedPlanAfter,
        creditsGranted: expectedCredits,
        ledgerEntriesCreated: scenario.validateNoDuplicateLedger ? 1 : undefined,
      },
      actualOutcome: {
        plan: stateAfter.profile?.subscription_plan,
        creditsGranted,
        ledgerEntriesCreated: ledgerCreated,
      },
      validations,
      passed,
    });
  } catch (e) {
    
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
