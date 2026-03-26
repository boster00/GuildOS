-- Metering: profiles.credits_remaining + credit_ledger (Step 1 schema only).
-- Source of truth for spend: profiles.credits_remaining; ledger for idempotent replay.

-- 1. Add credits_remaining to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 0;

-- 2. Create credit_ledger table
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL UNIQUE,
  action text NOT NULL,
  cost integer NOT NULL CHECK (cost >= 0),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Index for recent ledger per user
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger(user_id, created_at DESC);
