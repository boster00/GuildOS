/**
 * Master of Coins — single authority for subscription credit economy.
 * All logic in this file only. Access only via monkey.masterOfCoins.*
 * Uses: meterGrant (and RPC for processReset); getTierById for quotas.
 */

const { createHash } = require("crypto");
const { getTierById } = require("../registry/subscriptionTiers.js");
const { meterGrant } = require("../tools/metering.js");

const DEFAULT_MONTHLY_CREDITS = 50;

/** Valid PAYG credit package sizes (one-time purchase). */
const PAYG_PACKAGES = [30, 50, 100, 200, 500];

/** Valid PAYG tier identifiers. */
const PAYG_TIERS = ["starter", "pro"];

/** Deterministic UUID from string (for idempotency keys). */
function uuidFromString(str) {
  const hex = createHash("sha256").update(str, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Schedule a downgrade (writes work order only; no credit changes).
 * Downgrade applies at next reset (credits_reset_at boundary); no effective_at.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ profileId: string, toPlan: string, requested_at: string, source?: string }} opts
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function scheduleDowngrade(supabase, { profileId, toPlan, requested_at, source }) {
  if (!profileId || !toPlan || !requested_at) {
    return { ok: false, error: "profileId, toPlan, requested_at required" };
  }
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, coins_work_order")
    .eq("id", profileId)
    .single();
  if (fetchError || !profile) {
    return { ok: false, error: fetchError?.message || "profile not found" };
  }
  const workOrder = { ...(profile.coins_work_order || {}), version: 1 };
  workOrder.pending_change = {
    type: "downgrade",
    to_plan: toPlan,
    requested_at,
    source: source || null,
  };
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ coins_work_order: workOrder })
    .eq("id", profileId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

/**
 * Process reset for one profile (calls Postgres RPC; no app-level lock-then-do-rest).
 * RPC: lock, apply pending downgrade, expire monthly only, grant full monthly, idempotency.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ profileId: string }} opts
 * @param {(msg: string) => void} [log]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function processReset(supabase, { profileId }, log = console.log) {
  if (!profileId) {
    log("[processReset] Missing profileId");
    return { ok: false, error: "profileId required" };
  }

  log(`[processReset] Starting for profile ${profileId}`);

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, subscription_plan, credits_reset_at, subscription_period_start_at, coins_work_order")
    .eq("id", profileId)
    .single();

  if (fetchError || !profile) {
    log(`[processReset] Profile not found: ${fetchError?.message}`);
    return { ok: false, error: fetchError?.message || "profile not found" };
  }

  log("[processReset] Profile loaded", {
    profileId,
    plan: profile.subscription_plan,
    credits_reset_at: profile.credits_reset_at,
    has_pending: !!profile.coins_work_order?.pending_change,
    pending_change_type: profile.coins_work_order?.pending_change?.type,
  });

  const pendingToPlan =
    profile.coins_work_order?.pending_change?.type === "downgrade"
      ? profile.coins_work_order.pending_change.to_plan
      : null;
  const effectivePlan = pendingToPlan || profile.subscription_plan || "free";
  const tier = getTierById(effectivePlan);
  const monthlyQuota = tier?.monthlyCreditQuota ?? DEFAULT_MONTHLY_CREDITS;
  const periodEnd = profile.credits_reset_at || new Date().toISOString();
  const resetPeriodKey = `${profileId}_${periodEnd}`;
  const idempotencyKeyExpire = uuidFromString(`monthly_expire_${resetPeriodKey}`);
  const idempotencyKeyGrant = uuidFromString(`monthly_grant_${resetPeriodKey}`);

  log(`[processReset] Quota for effective plan ${effectivePlan} (db: ${profile.subscription_plan}): ${monthlyQuota}`);
  log("[processReset] Calling RPC", {
    profileId,
    monthlyQuota,
    resetPeriodKey,
    idempotencyKeyExpire,
    idempotencyKeyGrant,
  });

  const { data: rows, error: rpcError } = await supabase.rpc("master_of_coins_process_reset", {
    p_profile_id: profileId,
    p_monthly_quota: monthlyQuota,
    p_reset_period_key: resetPeriodKey,
    p_idempotency_key_expire: idempotencyKeyExpire,
    p_idempotency_key_grant: idempotencyKeyGrant,
  });

  const row = Array.isArray(rows) ? rows[0] : rows;

  log("[processReset] RPC result", {
    profileId,
    hasRow: !!row,
    skipped: row?.skipped,
    error: row?.error_message || rpcError?.message,
  });

  if (rpcError) {
    log(`[processReset] RPC error: ${rpcError.message}`);
    return { ok: false, error: rpcError.message };
  }
  if (!row) {
    log("[processReset] RPC returned no row");
    return { ok: false, error: "RPC returned no row" };
  }
  if (row.error_message) {
    log(`[processReset] RPC returned error: ${row.error_message}`);
    return { ok: false, error: row.error_message };
  }
  if (row.skipped) {
    log(`[processReset] Skipped (idempotent): ${profileId}`);
    return { ok: true, skipped: true };
  }

  log(`[processReset] Success: ${profileId}`);
  return { ok: true };
}

/**
 * Apply immediate upgrade: prorated credit delta only; do not expire or change period dates.
 * remainingFraction = clamp((period_end - now) / (period_end - period_start), 0, 1).
 * creditDelta = floor((newQuota - oldQuota) * remainingFraction); if <= 0 no-op.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ profileId: string, fromPlan: string, toPlan: string, period_start_at: string, period_end_at: string, now: string, idempotencyKey: string, stripeProrationInfo?: object, invoiceId?: string, subscriptionId?: string }} opts
 * @returns {Promise<{ ok: boolean, granted?: number, plan?: string, error?: string }>}
 */
async function applyImmediateUpgrade(supabase, opts) {
  const {
    profileId,
    fromPlan,
    toPlan,
    period_start_at,
    period_end_at,
    now,
    idempotencyKey,
    invoiceId,
    subscriptionId,
  } = opts;

  if (!profileId || !fromPlan || !toPlan || !period_end_at || !now || !idempotencyKey) {
    return { ok: false, error: "profileId, fromPlan, toPlan, period_end_at, now, idempotencyKey required" };
  }

  const end = new Date(period_end_at).getTime();
  const nowMs = new Date(now).getTime();
  // When period_start_at is null, assume 1-month billing period ending at period_end_at
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const start = period_start_at
    ? new Date(period_start_at).getTime()
    : Math.max(end - ONE_MONTH_MS, nowMs - ONE_MONTH_MS);
  const cycleMs = Math.max(end - start, 1);
  const remainingMs = Math.max(0, end - nowMs);
  const remainingFraction = Math.min(1, Math.max(0, remainingMs / cycleMs));

  const oldTier = getTierById(fromPlan);
  const newTier = getTierById(toPlan);
  if (!newTier) return { ok: false, error: "unknown toPlan" };
  const oldQuota = oldTier?.monthlyCreditQuota ?? 0;
  const newQuota = newTier.monthlyCreditQuota ?? 0;
  const creditDelta = Math.floor((newQuota - oldQuota) * remainingFraction);

  if (creditDelta <= 0) {
    return { ok: true, granted: 0, plan: toPlan };
  }

  const prorationFormula = `floor((${newQuota} - ${oldQuota}) * ${Number(remainingFraction.toFixed(4))}) = ${creditDelta}`;
  const grantResult = await meterGrant(supabase, {
    userId: profileId,
    action: "subscription_upgrade_prorated",
    creditAmount: creditDelta,
    idempotencyKey,
    meta: {
      fromPlan,
      toPlan,
      period_end_at,
      reason: "prorated_upgrade",
      proration_math: { formula: prorationFormula },
    },
    target: "monthly",
  });

  if (!grantResult.ok) {
    return { ok: false, error: "meterGrant failed" };
  }

  const updatePayload = { subscription_plan: toPlan };
  if (subscriptionId || invoiceId) {
    const { data: profileRow } = await supabase.from("profiles").select("subscription_meta").eq("id", profileId).single();
    const meta = { ...(profileRow?.subscription_meta || {}) };
    if (subscriptionId) meta.subscription_id = subscriptionId;
    if (invoiceId) meta.last_invoice_id = invoiceId;
    updatePayload.subscription_meta = meta;
  }
  await supabase.from("profiles").update(updatePayload).eq("id", profileId);

  return {
    ok: true,
    granted: creditDelta,
    plan: toPlan,
  };
}

/**
 * Grant PAYG (pay-as-you-go) credits from a one-time purchase.
 * Validates package size and tier; idempotent on stripeEventId.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ userId: string, credits: number, paygTier: string, stripeEventId: string, sessionId?: string }} opts
 * @returns {Promise<{ ok: boolean, granted?: boolean, error?: string }>}
 */
async function grantPayg(supabase, { userId, credits, paygTier, stripeEventId, sessionId }) {
  if (!userId || credits == null || !paygTier || !stripeEventId) {
    return { ok: false, error: "userId, credits, paygTier, stripeEventId required" };
  }
  const creditAmount = parseInt(credits, 10);
  if (!Number.isInteger(creditAmount) || creditAmount <= 0) {
    return { ok: false, error: "credits must be a positive integer" };
  }
  if (!PAYG_TIERS.includes(paygTier)) {
    return { ok: false, error: `Invalid PAYG tier: ${paygTier}` };
  }
  if (!PAYG_PACKAGES.includes(creditAmount)) {
    return { ok: false, error: `Invalid PAYG package size: ${creditAmount}` };
  }

  const idempotencyKey = uuidFromString(`payg_${stripeEventId}`);

  const grantResult = await meterGrant(supabase, {
    userId,
    action: "payg_purchase",
    creditAmount,
    idempotencyKey,
    meta: {
      source: "stripe",
      payg_tier: paygTier,
      stripe_event_id: stripeEventId,
      session_id: sessionId || null,
    },
    target: "payg",
  });

  if (!grantResult.ok) {
    return { ok: false, error: "meterGrant failed" };
  }

  return { ok: true, granted: Boolean(grantResult.granted) };
}

/**
 * Grant monthly credits for a sandbox subscription (mimics full Stripe flow).
 * @param {object} supabase - Supabase client (service role)
 * @param {{ userId: string, tierId: string, idempotencyKey: string }} opts
 * @returns {Promise<{ ok: boolean, granted: boolean, error?: string }>}
 */
async function grantSandboxSubscription(supabase, { userId, tierId, idempotencyKey }) {
  if (!userId || !tierId || !idempotencyKey) {
    return { ok: false, error: "userId, tierId, idempotencyKey required", granted: false };
  }

  const tier = getTierById(tierId);
  const creditAmount = tier?.monthlyCreditQuota ?? 0;
  if (creditAmount <= 0) {
    return { ok: true, granted: false };
  }

  const grantResult = await meterGrant(supabase, {
    userId,
    action: "subscription_grant",
    creditAmount,
    idempotencyKey,
    meta: { source: "sandbox", tierId },
    target: "monthly",
  });

  return { ok: true, granted: Boolean(grantResult?.granted) };
}

/**
 * Grant signup bonus (free-tier monthly credits). Idempotent on userId.
 * Called from signup webhook when a new row is inserted into auth.users.
 * @param {object} supabase - Supabase client (service role)
 * @param {{ userId: string }} opts
 * @returns {Promise<{ ok: boolean, granted: boolean, error?: string }>}
 */
async function grantSignup(supabase, { userId }) {
  if (!userId) return { ok: false, error: "userId required" };
  const tier = getTierById("free");
  const creditAmount = tier?.monthlyCreditQuota ?? DEFAULT_MONTHLY_CREDITS;
  const idempotencyKey = uuidFromString(`signup_${userId}`);
  const grantResult = await meterGrant(supabase, {
    userId,
    action: "signup_bonus",
    creditAmount,
    idempotencyKey,
    meta: { source: "signup", tier: "free" },
    target: "monthly",
  });
  return { ok: true, granted: Boolean(grantResult?.granted) };
}

module.exports = {
  scheduleDowngrade,
  processReset,
  applyImmediateUpgrade,
  grantPayg,
  grantSandboxSubscription,
  grantSignup,
};
