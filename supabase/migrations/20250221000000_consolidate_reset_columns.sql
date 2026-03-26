-- CRITICAL: Only run this AFTER code changes deployed and verified.
-- This migration removes subscription_renewal_at column.
-- Phase 1 (code): all code uses credits_reset_at; webhook sets credits_reset_at.
-- Phase 2 (this migration): backfill, then drop subscription_renewal_at.

-- 1. Backfill subscription_meta with period info (preserve for debugging)
UPDATE public.profiles
SET subscription_meta = jsonb_build_object(
  'period_start', subscription_period_start_at,
  'period_end', subscription_renewal_at,
  'price_id', stripe_price_id
) || COALESCE(subscription_meta, '{}'::jsonb)
WHERE subscription_renewal_at IS NOT NULL
  AND (subscription_meta IS NULL OR subscription_meta->>'period_end' IS NULL);

-- 2. Sync credits_reset_at from subscription_renewal_at (safety fallback)
UPDATE public.profiles
SET credits_reset_at = subscription_renewal_at
WHERE subscription_renewal_at IS NOT NULL
  AND (credits_reset_at IS NULL OR credits_reset_at != subscription_renewal_at);

-- 3. Drop subscription_renewal_at column (code already uses credits_reset_at)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS subscription_renewal_at;

-- 4. Drop old index
DROP INDEX IF EXISTS idx_profiles_subscription_renewal_at;

-- 5. Ensure index on credits_reset_at exists
CREATE INDEX IF NOT EXISTS idx_profiles_credits_reset_at
  ON public.profiles (credits_reset_at)
  WHERE credits_reset_at IS NOT NULL;

-- 6. Update comments
COMMENT ON COLUMN public.profiles.credits_reset_at IS
  'Single source of truth for when to reset monthly credits. Synced with Stripe current_period_end for paid subscriptions. Worker selects due profiles by credits_reset_at <= now(). Nullable: worker must ignore null values.';

COMMENT ON COLUMN public.profiles.subscription_period_start_at IS
  'Stripe subscription current_period_start. Used for proration fraction calculation. Set by webhook on subscription create/update.';

COMMENT ON COLUMN public.profiles.subscription_meta IS
  'Debug-only JSONB: {price_id, period_start, period_end, last_invoice_id, subscription_id}. Read-only reference; worker uses credits_reset_at for scheduling.';
