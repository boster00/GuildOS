-- Master of Coins: work order, Stripe period columns, subscription_meta.
-- Period columns are Stripe-owned (current_period_start/end). Worker selects due by subscription_renewal_at <= now().

-- 1. coins_work_order: scheduled actions + idempotency (reset keyed by period, upgrade by invoice_id)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins_work_order jsonb NULL;

COMMENT ON COLUMN public.profiles.coins_work_order IS 'Work order: version, pending_change (downgrade), idempotency (reset_period_key, last_invoice_id). Do not store long-lived Stripe anchors here; use subscription_meta.';

-- 2. Stripe period columns (source: Stripe subscription current_period_start/end)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_renewal_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_period_start_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.subscription_renewal_at IS 'Stripe current_period_end; when monthly renewal is due. Worker selects due by subscription_renewal_at <= now().';
COMMENT ON COLUMN public.profiles.subscription_period_start_at IS 'Stripe current_period_start; required for proration and idempotency.';

-- 3. Index for worker "due for reset" queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_renewal_at
  ON public.profiles (subscription_renewal_at)
  WHERE subscription_renewal_at IS NOT NULL;

-- 4. subscription_meta: Stripe IDs and stable subscription metadata (recommended over overloading coins_work_order)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_meta jsonb NULL;

COMMENT ON COLUMN public.profiles.subscription_meta IS 'Stripe subscription metadata (subscription_id, customer_id, price_id, etc.). Long-lived; not cleared by reset.';
