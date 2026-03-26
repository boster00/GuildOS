-- Stripe columns: prefix with stripe_, deterministic handling of legacy price_id.
-- Run after verifying profiles.price_id contents (sub_* vs price_*) if needed.
-- Cancellation: at period end (set free only on customer.subscription.deleted).

-- 1. Rename customer_id → stripe_customer_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN customer_id TO stripe_customer_id;
  END IF;
END $$;

-- 2. Add stripe_subscription_id (sub_xxx) and optionally stripe_price_id (price_xxx)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 3. Backfill from price_id if it exists: deterministic by prefix
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'price_id'
  ) THEN
    UPDATE public.profiles
    SET
      stripe_subscription_id = CASE WHEN price_id LIKE 'sub_%' THEN price_id ELSE stripe_subscription_id END,
      stripe_price_id = CASE WHEN price_id LIKE 'price_%' THEN price_id ELSE stripe_price_id END
    WHERE price_id IS NOT NULL;
    ALTER TABLE public.profiles DROP COLUMN price_id;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID (cus_...) - required for invoice lookups';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.profiles.stripe_price_id IS 'Stripe price ID (price_...) - optional, plan can be derived from subscription';

-- 4. credit_ledger: idempotency_key already has UNIQUE in 20250208100000_metering_credits_ledger.sql (prevents double-grants).
