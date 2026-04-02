/**
 * Metering module: credit calculation, quota check, usage log, deduction.
 * Single place for DISABLE_METERING / ENABLE_METERING. When off, checkQuota allows,
 * logUsage and deductCredits no-op.
 *
 * Env: DISABLE_METERING, ENABLE_METERING, UNLIMITED_QUOTA, ADMIN_UNLIMITED_QUOTA,
 *      METERING_TEST_QUOTA, ADMIN_EMAIL
 *
 * Credits balance rule: Do not update profiles.credits_remaining without inserting
 * a corresponding row in credit_ledger in the same transaction. All balance changes
 * go through the ledger (debit = positive cost, credit = negative cost). Use
 * meterSpend for debits and meterGrant for credits.
 *
 * creditUpdated: global (in-process) flag per userId. Set true when a positive
 * meterSpend (charged) runs; consumed by GET /api/credits/updated so the frontend
 * only refetches credits when something actually changed.
 */
const creditUpdatedByUser = new Map();

/** Set when this user's credits were just updated (e.g. meterSpend charged). */
export function markCreditUpdated(userId) {
  if (userId) creditUpdatedByUser.set(userId, true);
}

/** Returns true if credits were updated since last consume; clears the flag for this user. */
export function consumeCreditUpdated(userId) {
  if (!userId) return false;
  const v = creditUpdatedByUser.get(userId) === true;
  creditUpdatedByUser.set(userId, false);
  return v;
}

const METERING_CODE_QUOTA_EXCEEDED = 'QUOTA_EXCEEDED';

const METERING_ERROR_MESSAGES = {
  [METERING_CODE_QUOTA_EXCEEDED]: 'Monthly quota exceeded',
  TRIAL_EXPIRED: 'Free trial expired',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
};

/**
 * Thrown when meterSpend fails with OUT_OF_CREDITS. Routes should catch and return 429 + set cookie.
 */
export class OutOfCreditsError extends Error {
  constructor(remaining) {
    super('Out of credits');
    this.name = 'OutOfCreditsError';
    this.remaining = remaining;
  }
}

const DEFAULT_MARKUPS = {
  openai_text: 0,
  openai_image: 0,
  openai_embedding: 0,
  tavily_search: 0,
  tavily_extract: 0,
  dataforseo: 0,
  v0: 0,
  runtime: 0,
};

export function isMeteringEnabled() {
  const disabled = process.env.DISABLE_METERING === 'true' || process.env.DISABLE_METERING === true;
  const enabled = process.env.ENABLE_METERING === 'true' || process.env.ENABLE_METERING === true;
  return !disabled && enabled;
}

/**
 * Single gate: whether to apply metering (quota check, log, deduct).
 * Reads env bypasses and optional cookie override (adapter.getMeteringOverride); no DB preference.
 * @param {string} userId
 * @param {{ read, log, getMeteringOverride? }} adapter
 * @returns {Promise<boolean>}
 */
async function shouldApplyMetering(userId, adapter) {
  if (!userId) return false;
  if (process.env.UNLIMITED_QUOTA === 'true' || process.env.UNLIMITED_QUOTA === true) return false;
  if (process.env.ADMIN_UNLIMITED_QUOTA === 'true' || process.env.ADMIN_UNLIMITED_QUOTA === true) return false;
  if (process.env.DISABLE_METERING === 'true' || process.env.DISABLE_METERING === true) return false;
  if (!isMeteringEnabled()) return false;
  if (adapter.getMeteringOverride && adapter.getMeteringOverride() === false) {
    adapter.log('[shouldApplyMetering] cookie override: metering off');
    return false;
  }
  return true;
}

function getNextMonthReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString();
}

function throwQuotaDenied(reason, used, quota) {
  const err = new Error(reason || 'Quota exceeded');
  err.code = METERING_CODE_QUOTA_EXCEEDED;
  err.quotaUsed = used;
  err.quotaLimit = quota;
  throw err;
}

/**
 * Calculate CJGEO credits for API usage. Pure function.
 * @param {string} type - API type
 * @param {Object} params - Parameters for cost
 * @param {Object} [markups] - Optional markups by type (defaults to 0)
 * @returns {number} Credits (rounded to 4 decimal places)
 */
export function calculateCredits(type, params = {}, markups = {}) {
  let costUSD = 0;
  try {
    switch (type) {
      case 'openai_text': {
        const { model, prompt_tokens = 0, completion_tokens = 0 } = params;
        const pricing = {
          'gpt-4o': { input: 5.0, output: 15.0 },
          'gpt-4o-2024-08-06': { input: 5.0, output: 15.0 },
          'gpt-4o-mini': { input: 0.15, output: 0.60 },
          'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60 },
          'gpt-4-turbo': { input: 10.0, output: 30.0 },
          'gpt-4': { input: 30.0, output: 60.0 },
          'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
          'o1-preview': { input: 15.0, output: 60.0 },
          'o1-mini': { input: 3.0, output: 12.0 },
        };
        const modelPricing = pricing[model] || pricing['gpt-4o'];
        costUSD = (prompt_tokens / 1_000_000) * modelPricing.input + (completion_tokens / 1_000_000) * modelPricing.output;
        break;
      }
      case 'openai_image': {
        const { model, quality = 'standard', count = 1 } = params;
        if (model?.includes('dall-e-3') || model?.includes('dall-e') || model?.includes('gpt-image')) {
          costUSD = quality === 'hd' ? 0.08 * count : 0.04 * count;
        } else {
          costUSD = 0.04 * count;
        }
        break;
      }
      case 'openai_embedding': {
        const { tokens = 0 } = params;
        costUSD = (tokens / 1_000_000) * 0.02;
        break;
      }
      case 'tavily_search': {
        const { count = 1, advanced = false } = params;
        costUSD = advanced ? 0.01 * count : 0.005 * count;
        break;
      }
      case 'tavily_extract': {
        const { urlCount = 1, advanced = false } = params;
        costUSD = advanced ? 0.002 * urlCount : 0.001 * urlCount;
        break;
      }
      case 'dataforseo': {
        const { count = 1, priority = 'standard' } = params;
        costUSD = priority === 'priority' ? 0.0012 * count : 0.0006 * count;
        break;
      }
      case 'v0': {
        const { model = 'v0-mini', prompt_tokens = 0, completion_tokens = 0 } = params;
        const pricing = { 'v0-mini': { input: 0.50, output: 2.0 }, 'v0-pro': { input: 1.50, output: 7.50 }, 'v0-max': { input: 2.0, output: 10.0 } };
        const modelPricing = pricing[model] || pricing['v0-mini'];
        costUSD = (prompt_tokens / 1_000_000) * modelPricing.input + (completion_tokens / 1_000_000) * modelPricing.output;
        break;
      }
      case 'runtime': {
        const { model, prompt_tokens = 0, completion_tokens = 0 } = params;
        const pricing = { 'gpt-4o': { input: 5.0, output: 15.0 }, 'gpt-4o-mini': { input: 0.15, output: 0.60 }, 'gpt-4-turbo': { input: 10.0, output: 30.0 }, 'gpt-3.5-turbo': { input: 0.50, output: 1.50 } };
        const modelPricing = pricing[model] || pricing['gpt-4o'];
        costUSD = (prompt_tokens / 1_000_000) * modelPricing.input + (completion_tokens / 1_000_000) * modelPricing.output;
        break;
      }
      default:
        return 0;
    }
    const m = { ...DEFAULT_MARKUPS, ...markups };
    const markup = m[type] || 0;
    const costWithMarkup = costUSD * (1 + markup);
    const credits = costWithMarkup / 0.10;
    return Math.round(credits * 10000) / 10000;
  } catch (error) {
    return 0;
  }
}

/**
 * Rough credit estimate for quota check.
 */
export function estimateCredits(type, params = {}, markups = {}) {
  switch (type) {
    case 'openai_text':
      return calculateCredits('openai_text', { model: params.model || 'gpt-4o-mini', prompt_tokens: 2000, completion_tokens: 1000 }, markups);
    case 'openai_image':
      return calculateCredits('openai_image', { model: 'dall-e-3', count: 1 }, markups);
    case 'openai_embedding':
      return calculateCredits('openai_embedding', { tokens: params.tokens || 1000 }, markups);
    case 'tavily_search':
      return calculateCredits('tavily_search', { count: 1 }, markups);
    case 'tavily_extract':
      return calculateCredits('tavily_extract', { urlCount: params.urlCount || 1 }, markups);
    case 'dataforseo':
      return calculateCredits('dataforseo', { count: params.count || 1 }, markups);
    case 'v0':
      return calculateCredits('v0', { model: 'v0-mini', prompt_tokens: 10000, completion_tokens: 20000 }, markups);
    case 'runtime':
      return estimateCredits('openai_text', params, markups);
    default:
      return 1;
  }
}

/**
 * Check if user has quota. Throws on deny. Returns { allowed: true } on allow.
 * When planContext is provided, profile/tier are taken from it (no profiles read for tier).
 * @param {string} userId
 * @param {number} requiredCredits
 * @param {{ read, write, update, log, getTierById? }} adapter
 * @param {{ planContext?: import('../planContext.js').PlanContext | null }} [opts]
 */
export async function checkQuota(userId, requiredCredits, adapter, opts = {}) {
  const { read, write, update, log } = adapter;
  const planContext = opts.planContext;
  log('[checkQuota] ENTRY userId=', userId, 'requiredCredits=', requiredCredits, 'planContext=', !!planContext);
  if (!(await shouldApplyMetering(userId, adapter))) {
    log('[checkQuota] BYPASS: shouldApplyMetering false → allowed: true');
    return { allowed: true };
  }
  log('[checkQuota] Running full quota check (DB)...');
  try {
    let profile;
    if (planContext) {
      profile = {
        override_quota: planContext.override_quota,
        email: planContext.email,
        trial_ends_at: planContext.trial_ends_at,
        subscription_plan: planContext.subscription_plan,
      };
    } else {
      const profileRows = await read('profiles', [{ operator: 'eq', args: ['id', userId] }]);
      if (!profileRows || !profileRows[0]) {
        log('[checkQuota] DENY: User not found');
        throwQuotaDenied('User not found');
      }
      profile = profileRows[0];
    }
    if (profile.override_quota) {
      log('[checkQuota] ALLOW: profile.override_quota');
      return { allowed: true };
    }
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && profile.email && String(profile.email).toLowerCase() === String(adminEmail).toLowerCase()) {
      log('[checkQuota] ALLOW: admin email match');
      return { allowed: true };
    }
    const tierId = profile.subscription_plan || 'free';
    if (tierId === 'free' && profile.trial_ends_at) {
      const trialEnds = new Date(profile.trial_ends_at);
      if (new Date() > trialEnds) {
        log('[checkQuota] DENY: Free trial expired');
        const err = new Error('Free trial expired');
        err.code = 'TRIAL_EXPIRED';
        err.upgrade_required = true;
        throw err;
      }
    }
    let quota;
    if (planContext && planContext.limits) {
      quota = parseInt(planContext.limits.monthlyCreditQuota, 10) || 0;
    } else {
      const { getTierById } = adapter;
      const tier = getTierById ? getTierById(tierId) : null;
      if (!tier) {
        log('[checkQuota] DENY: Invalid subscription tier');
        throwQuotaDenied('Invalid subscription tier');
      }
      quota = parseInt(tier.monthlyCreditQuota, 10) || 0;
    }
    if (quota === 0) {
      log('[checkQuota] ALLOW: tier.monthly_credit_quota === 0');
      return { allowed: true };
    }
    let creditRows = await read('user_credits', [{ operator: 'eq', args: ['user_id', userId] }]);
    let userCredits = creditRows && creditRows[0] ? creditRows[0] : null;
    if (!userCredits) {
      await write('user_credits', {
        user_id: userId,
        credit_balance: 0,
        credits_purchased: 0,
        credits_used: 0,
        monthly_credits_used: 0,
        monthly_usage_reset_at: getNextMonthReset(),
      });
      log('[checkQuota] ALLOW: no user_credits row, created and allowed');
      return { allowed: true };
    }
    const resetAt = userCredits.monthly_usage_reset_at ? new Date(userCredits.monthly_usage_reset_at) : null;
    if (resetAt && new Date() > resetAt) {
      await update('user_credits', {
        monthly_credits_used: 0,
        monthly_usage_reset_at: getNextMonthReset(),
        updated_at: new Date().toISOString(),
      }, [{ operator: 'eq', args: ['user_id', userId] }]);
      userCredits = { ...userCredits, monthly_credits_used: 0 };
    }
    const used = parseFloat(userCredits.monthly_credits_used) || 0;
    const testQuotaEnv = process.env.METERING_TEST_QUOTA != null && process.env.METERING_TEST_QUOTA !== '' ? parseInt(process.env.METERING_TEST_QUOTA, 10) : null;
    const effectiveQuota = testQuotaEnv != null && !Number.isNaN(testQuotaEnv) ? testQuotaEnv : (quota ?? 0);
    const projected = used + (parseFloat(requiredCredits) || 0);
    const graceQuota = effectiveQuota * 1.10;
    log('[checkQuota] used=', used, 'effectiveQuota=', effectiveQuota, 'projected=', projected, 'graceQuota=', graceQuota);
    if (projected > graceQuota) {
      log('[checkQuota] DENY: Grace period exceeded');
      throwQuotaDenied('Grace period exceeded', used, effectiveQuota);
    }
    if (projected > effectiveQuota) {
      log('[checkQuota] ALLOW: in grace period');
      return { allowed: true, inGracePeriod: true, used, quota: effectiveQuota };
    }
    log('[checkQuota] ALLOW: under quota');
    return { allowed: true, used, quota: effectiveQuota };
  } catch (err) {
    if (err.code === METERING_CODE_QUOTA_EXCEEDED || err.code === 'TRIAL_EXPIRED') throw err;
    log('[checkQuota] Error (→ Service temporarily unavailable):', err.message);
    if (err && (String(err.message || '').includes('Unauthorized') || err.status === 401)) {
      log('[checkQuota] BYPASS: DB check failed with Unauthorized → allowing');
      return { allowed: true };
    }
    const svc = new Error('Service temporarily unavailable');
    svc.code = 'SERVICE_UNAVAILABLE';
    throw svc;
  }
}

/**
 * Log API usage. No-op when shouldApplyMetering is false.
 * api_usage_logs is obsolete; usage is recorded in credit_ledger via meterSpend.
 * This remains a no-op for backward compatibility with call sites.
 */
export async function logUsage(userId, apiProvider, apiType, params, credits, costUSD, adapter) {
  if (!(await shouldApplyMetering(userId, adapter))) return;
  // api_usage_logs table removed; usage is in credit_ledger (meterSpend). No-op.
}

/**
 * Deduct credits after successful API call. No-op when shouldApplyMetering is false.
 */
export async function deductCredits(userId, credits, adapter) {
  if (!userId || credits <= 0) return;
  if (!(await shouldApplyMetering(userId, adapter))) return;
  const { read, write, update, log } = adapter;
  try {
    const rows = await read('user_credits', [{ operator: 'eq', args: ['user_id', userId] }]);
    const row = rows && rows[0] ? rows[0] : null;
    if (!row) {
      await write('user_credits', {
        user_id: userId,
        credit_balance: 0,
        credits_purchased: 0,
        credits_used: credits,
        monthly_credits_used: credits,
        monthly_usage_reset_at: getNextMonthReset(),
        updated_at: new Date().toISOString(),
      });
      return;
    }
    const newCreditsUsed = Math.max(0, (parseFloat(row.credits_used) || 0) + credits);
    const newMonthlyUsed = Math.max(0, (parseFloat(row.monthly_credits_used) || 0) + credits);
    await update('user_credits', {
      credits_used: newCreditsUsed,
      monthly_credits_used: newMonthlyUsed,
      updated_at: new Date().toISOString(),
    }, [{ operator: 'eq', args: ['user_id', userId] }]);
  } catch (err) {
    log('[deductCredits] Error:', err.message);
  }
}

/**
 * Atomic spend + ledger insert (idempotent by idempotencyKey).
 * Uses profiles.credits_remaining first, then payg_wallet. Records monthly_cost and payg_cost in ledger.
 *
 * @param {object} supabase - Supabase client (service role or server)
 * @param {{ userId: string, action: string, cost: number, idempotencyKey: string, meta?: object }} opts
 * @returns {Promise<{ ok: boolean, charged: boolean, remaining: number|null, code?: string, monthlyCost?: number, paygCost?: number, remainingMonthly?: number, remainingPayg?: number }>}
 */
export async function meterSpend(supabase, { userId, action, cost, idempotencyKey, meta }) {
  const costNum = cost != null ? Number(cost) : null;
  if (costNum == null || Number.isNaN(costNum) || costNum <= 0) {
    return { ok: true, remaining: null, charged: false };
  }
  const { data, error } = await supabase.rpc('meter_spend', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_action: action,
    p_cost: costNum,
    p_meta: meta ?? null,
  });
  if (error) {
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('meter_spend RPC returned no row');
  }
  const result = {
    ok: Boolean(row.ok),
    charged: Boolean(row.charged),
    remaining: row.remaining != null ? Number(row.remaining) : null,
  };
  if (row.code) result.code = row.code;
  if (row.monthly_cost != null) result.monthlyCost = row.monthly_cost;
  if (row.payg_cost != null) result.paygCost = row.payg_cost;
  if (row.remaining_monthly != null) result.remainingMonthly = Number(row.remaining_monthly);
  if (row.remaining_payg != null) result.remainingPayg = Number(row.remaining_payg);
  if (row.ledger_id != null) result.ledgerId = row.ledger_id;

  if (result.charged && userId) {
    markCreditUpdated(userId);
  }
  return result;
}

/**
 * Atomic grant (add credits) + ledger insert (idempotent by idempotencyKey).
 * target 'monthly' adds to credits_remaining; target 'payg' adds to payg_wallet.
 *
 * @param {object} supabase - Supabase client (service role or server)
 * @param {{ userId: string, action: string, creditAmount: number, idempotencyKey: string, meta?: object, target?: 'monthly'|'payg' }} opts
 * @returns {Promise<{ ok: boolean, granted: boolean, remaining: number|null, remainingMonthly?: number, remainingPayg?: number }>}
 */
export async function meterGrant(supabase, { userId, action, creditAmount, idempotencyKey, meta, target }) {
  if (creditAmount == null || creditAmount <= 0) {
    return { ok: true, granted: false, remaining: null };
  }
  const { data, error } = await supabase.rpc('meter_grant', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_action: action,
    p_credit_amount: creditAmount,
    p_meta: meta ?? null,
    p_target: target === 'payg' ? 'payg' : 'monthly',
  });
  if (error) {

    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {

    throw new Error('meter_grant RPC returned no row');
  }
  const out = {
    ok: Boolean(row.ok),
    granted: Boolean(row.granted),
    remaining: row.remaining != null ? row.remaining : null,
  };
  if (row.remaining_monthly != null) out.remainingMonthly = row.remaining_monthly;
  if (row.remaining_payg != null) out.remainingPayg = row.remaining_payg;
  if (out.granted && userId) {
    markCreditUpdated(userId);
  }
  return out;
}

/**
 * Reset user balance to zero via ledger (test-only). Inserts a ledger row that zeros both pools.
 * No direct profile updates; trigger syncs balance to profiles.
 *
 * @param {object} supabase - Supabase client (service role or server)
 * @param {{ userId: string }} opts
 * @returns {Promise<{ ok: boolean }>}
 */
export async function meterReset(supabase, { userId }) {
  const { data, error } = await supabase.rpc('meter_reset', {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: Boolean(row?.ok) };
}

/**
 * Helper for route handlers: perform metering if body.metering is present.
 * @param {object} supabase - Supabase client
 * @param {object} user - Auth user object
 * @param {object} body - Request body (may contain metering)
 * @returns {Promise<{ charged: boolean, remaining: number|null } | null>}
 *   Returns null if no metering, or { charged, remaining } if metering was performed.
 *   Throws OutOfCreditsError if OUT_OF_CREDITS.
 */
export async function handleRouteMetering(supabase, user, body) {
  if (!body?.metering || typeof body.metering !== 'object') {
    return null;
  }
  const { action, idempotencyKey, meta } = body.metering;
  if (!action || !idempotencyKey) {
    return null;
  }
  const { getCost } = await import('./metering_costs.js');
  const cost = getCost(action);
  const result = await meterSpend(supabase, {
    userId: user.id,
    action,
    cost,
    idempotencyKey,
    meta: meta ?? null,
  });
  if (!result.ok && result.code === 'OUT_OF_CREDITS') {
    throw new OutOfCreditsError(result.remaining);
  }
  return { charged: result.charged, remaining: result.remaining };
}

/**
 * Returns the canonical HTTP response for metering errors, or null.
 */
export function getMeteringErrorResponse(error) {
  if (!error || typeof error !== 'object') return null;
  const code =
    error.code ||
    (error.status === 429 ? METERING_CODE_QUOTA_EXCEEDED : null) ||
    (error.message && error.message.includes('quota') ? METERING_CODE_QUOTA_EXCEEDED : null);
  if (code === METERING_CODE_QUOTA_EXCEEDED) {
    return {
      status: 429,
      body: {
        error: METERING_ERROR_MESSAGES[METERING_CODE_QUOTA_EXCEEDED],
        details: {
          upgrade_url: '/billing',
          ...(error.quotaUsed != null && { used: error.quotaUsed }),
          ...(error.quotaLimit != null && { quota: error.quotaLimit }),
        },
      },
    };
  }
  if (code === 'TRIAL_EXPIRED') {
    return { status: 403, body: { error: METERING_ERROR_MESSAGES.TRIAL_EXPIRED, details: { upgrade_url: '/billing' } } };
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return { status: 503, body: { error: METERING_ERROR_MESSAGES.SERVICE_UNAVAILABLE } };
  }
  return null;
}

export { METERING_CODE_QUOTA_EXCEEDED };
