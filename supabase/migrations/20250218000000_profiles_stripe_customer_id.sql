-- Ensure stripe_customer_id exists on profiles (idempotent).
-- 20250217000000 only renames customer_id -> stripe_customer_id when customer_id exists;
-- if the table never had customer_id, this column would be missing.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID (cus_...) - required for invoice lookups';
