// ARCHIVED: Original path was libs/monkey/tools/monthly_credits_refresh.js

/**
 * Daily job: monthly credits refresh for users whose credits_reset_at <= now() (per-account signup-based).
 * Ledger reflects: (1) expire remaining credits (cost xxx), (2) new credits granted (negative cost).
 * Idempotent per user per period.
 */

import { createHash } from "crypto";
import { meterSpend, meterGrant } from "./metering.js";
import { getTierById, DEFAULT_MONTHLY_CREDITS } from "../../monkey.js";

/** Deterministic UUID from string (for idempotency key per user per period). */
function uuidFromString(str) {
  const hex = createHash("sha256").update(str, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Run monthly credits refresh: for each user due, (1) expire remaining credits via ledger (cost xxx), (2) grant new monthly credits via ledger.
 * @param {object} supabase - Supabase client (service role)
 * @param {(msg: string) => void} [log] - Optional logger
 * @returns {{ success: boolean, granted: number, error?: string }}
 */
export async function runMonthlyCreditsRefresh(supabase, log = () => {}) {
  try {
    const now = new Date().toISOString();
    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, credits_remaining, credits_reset_at, subscription_plan")
      .not("credits_reset_at", "is", null)
      .lte("credits_reset_at", now);

    if (fetchError) {
      log(`[monthly_credits_refresh] fetch error: ${fetchError.message}`);
      return { success: false, granted: 0, error: fetchError.message };
    }

    if (!profiles?.length) {
      log("[monthly_credits_refresh] no profiles due for reset");
      return { success: true, granted: 0 };
    }

    const tierIds = [...new Set(profiles.map((p) => p.subscription_plan).filter(Boolean))];
    const quotaByTier = Object.fromEntries(
      tierIds.map((id) => {
        const tier = getTierById(id);
        return [id, tier?.monthlyCreditQuota ?? DEFAULT_MONTHLY_CREDITS];
      })
    );

    let granted = 0;
    for (const profile of profiles) {
      const periodStart = profile.credits_reset_at;
      const currentBalance = Math.max(0, Number(profile.credits_remaining) || 0);

      // 1. Expire remaining credits: ledger entry with cost = current balance (debit)
      if (currentBalance > 0) {
        const expireKey = uuidFromString(`monthly_expire_${profile.id}_${periodStart}`);
        const expireResult = await meterSpend(supabase, {
          userId: profile.id,
          action: "monthly_expire",
          cost: currentBalance,
          idempotencyKey: expireKey,
          meta: { period_start: periodStart, reason: "monthly_reset" },
        });
        if (!expireResult.ok) {
          log(`[monthly_credits_refresh] expire failed for ${profile.id}`);
          continue;
        }
      }

      const quota = profile.subscription_plan
        ? (quotaByTier[profile.subscription_plan] ?? getTierById(profile.subscription_plan)?.monthlyCreditQuota ?? DEFAULT_MONTHLY_CREDITS)
        : DEFAULT_MONTHLY_CREDITS;
      if (quota <= 0) {
        // Advance reset date even if quota is 0 so we don't keep selecting them
        const nextReset = new Date(profile.credits_reset_at);
        nextReset.setMonth(nextReset.getMonth() + 1);
        await supabase
          .from("profiles")
          .update({ credits_reset_at: nextReset.toISOString() })
          .eq("id", profile.id);
        continue;
      }

      // 2. Grant new monthly credits: ledger entry with negative cost (credit)
      const grantKey = uuidFromString(`monthly_grant_${profile.id}_${periodStart}`);
      const result = await meterGrant(supabase, {
        userId: profile.id,
        action: "monthly_grant",
        creditAmount: quota,
        idempotencyKey: grantKey,
        meta: { period_start: periodStart },
        target: "monthly",
      });

      if (!result.ok) {
        log(`[monthly_credits_refresh] grant failed for ${profile.id}`);
        continue;
      }
      if (result.granted) {
        granted++;
        const nextReset = new Date(profile.credits_reset_at);
        nextReset.setMonth(nextReset.getMonth() + 1);
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ credits_reset_at: nextReset.toISOString() })
          .eq("id", profile.id);
        if (updateErr) {
          log(`[monthly_credits_refresh] failed to advance reset_at for ${profile.id}: ${updateErr.message}`);
        }
      }
    }

    log(`[monthly_credits_refresh] granted ${granted} users`);
    return { success: true, granted };
  } catch (err) {
    log(`[monthly_credits_refresh] error: ${err.message}`);
    return { success: false, granted: 0, error: err.message };
  }
}
