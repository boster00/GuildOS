/**
 * PlanContext: single per-request object for subscription tier and limits.
 * API routes must use getPlanContext(supabase, user.id) and consume PlanContext;
 * they must not query profiles.subscription_plan or call getTierById directly.
 */

import { getTierById, getLimitsForTierId } from "./registry/subscriptionTiers.js";

/** @typedef {{
 *   profile_id: string,
 *   subscription_plan: string,
 *   tier_name: string,
 *   has_access: boolean,
 *   subscription_status: string,
 *   metering_enabled: boolean,
 *   customer_id: string | null,
 *   stripe_customer_id: string | null,
 *   email: string | null,
 *   name: string | null,
 *   override_quota: boolean,
 *   trial_ends_at: string | null,
 *   credits_reset_at: string | null,
 *   coins_work_order: object | null,
 *   limits: {
 *     monthlyCreditQuota: number,
 *     maxPendingExternal: number,
 *     maxProjects: number | string,
 *     scheduledRuns: string,
 *     dataRetention: string,
 *   },
 * }} PlanContext */

const ACTIVE_STATUSES = ["active", "trialing", "trialing_active"];

/**
 * Fetch plan context for a user (one DB read: profiles). No global cache; call once per request.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<PlanContext | null>}
 */
async function fetchPlanContext(supabase, userId) {
  if (!userId) {
    return null;
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, name, subscription_plan, stripe_customer_id, stripe_subscription_id, credits_reset_at, coins_work_order")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  const plan = profile.subscription_plan ?? "free";
  const tier = getTierById(plan);
  const limits = getLimitsForTierId(plan);
  const status = "active";
  const has_access = ACTIVE_STATUSES.includes(status) || status === "";

  return {
    profile_id: profile.id,
    subscription_plan: plan,
    tier_name: tier ? tier.name : "Free",
    has_access,
    subscription_status: "active",
    metering_enabled: true,
    customer_id: profile.stripe_customer_id ?? null,
    stripe_customer_id: profile.stripe_customer_id ?? null,
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
    email: profile.email ?? null,
    name: profile.name ?? null,
    override_quota: false,
    trial_ends_at: null,
    credits_reset_at: profile.credits_reset_at ?? null,
    coins_work_order: profile.coins_work_order ?? null,
    limits: {
      monthlyCreditQuota: limits.monthlyCreditQuota,
      maxPendingExternal: limits.maxPendingExternal,
      maxProjects: limits.maxProjects,
      scheduledRuns: limits.scheduledRuns,
      dataRetention: limits.dataRetention,
    },
  };
}

/**
 * Get plan context for the current request. Thin wrapper around fetchPlanContext.
 * Call once per request and pass the result down; no request-scoped cache in this module.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<PlanContext | null>}
 */
async function getPlanContext(supabase, userId) {
  return fetchPlanContext(supabase, userId);
}

/**
 * Error thrown when a plan check fails (e.g. feature not allowed or limit exceeded).
 */
class PlanAssertionError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "PlanAssertionError";
    this.code = opts.code ?? "PLAN_ASSERTION_FAILED";
    this.status = opts.status ?? 403;
  }
}

/** Numeric cap for maxProjects when tier has "higher" (unlimited-style). */
const MAX_PROJECTS_HIGHER = 100;

/**
 * Assert that the plan allows the feature (or limit check). Throws PlanAssertionError if not.
 * @param {PlanContext | null | undefined} plan
 * @param {string} feature - e.g. "image_generation", "metering_spend", "external_requests", "max_pending_external", "projects.create", "scheduler.daily", "external.concurrency"
 * @param {{ currentPending?: number, currentProjectCount?: number }} [opts]
 * @throws {PlanAssertionError}
 */
function assertPlan(plan, feature, opts = {}) {
  if (plan == null) {
    throw new PlanAssertionError("Plan context not available", { code: "NO_PLAN", status: 401 });
  }
  if (!plan.has_access) {
    throw new PlanAssertionError("Subscription access required", { code: "NO_ACCESS", status: 403 });
  }

  if (feature === "max_pending_external" || feature === "external.concurrency") {
    const limit = plan.limits?.maxPendingExternal ?? 1;
    const current = opts.currentPending ?? 0;
    if (current >= limit) {
      throw new PlanAssertionError(
        "Too many active external calls, retry later or upgrade",
        { code: "LIMIT_EXCEEDED", status: 429 }
      );
    }
    return;
  }

  if (feature === "projects.create") {
    const raw = plan.limits?.maxProjects;
    const limit = typeof raw === "number" ? raw : (raw === "higher" ? MAX_PROJECTS_HIGHER : 1);
    const current = opts.currentProjectCount ?? 0;
    if (current >= limit) {
      throw new PlanAssertionError(
        "Project limit reached for your plan",
        { code: "LIMIT_EXCEEDED", status: 403 }
      );
    }
    return;
  }

  if (feature === "scheduler.daily" || feature === "scheduledRuns") {
    const runs = plan.limits?.scheduledRuns ?? "monthly";
    if (runs !== "daily_weekly") {
      throw new PlanAssertionError(
        "Daily/weekly scheduled runs require a plan that includes them",
        { code: "PLAN_LIMIT", status: 403 }
      );
    }
    return;
  }

  // All other features: any valid plan with has_access is allowed.
  const allowedFeatures = [
    "image_generation",
    "metering_spend",
    "external_requests",
  ];
  if (!allowedFeatures.includes(feature)) {
    throw new PlanAssertionError(`Unknown feature: ${feature}`, { status: 500 });
  }
}

export { fetchPlanContext, getPlanContext, assertPlan, PlanAssertionError };
