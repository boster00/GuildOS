-- Migration: Usage metering and SaaS tier tables
-- Creates subscription_tiers, api_usage_logs, user_credits; alters profiles for tier/status

-- 1. subscription_tiers (no dependencies)
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id text NOT NULL,
  name text NOT NULL,
  stripe_price_id text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  monthly_credit_quota integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.subscription_tiers.monthly_credit_quota IS '0 means unlimited';

-- 2. Alter profiles: add subscription_tier_id, subscription_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_tier_id text REFERENCES public.subscription_tiers(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_status text NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'override_quota'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN override_quota boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN trial_ends_at timestamp with time zone;
  END IF;
END $$;

-- 3. api_usage_logs
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_provider text NOT NULL,
  api_type text NOT NULL,
  method text NOT NULL DEFAULT 'unknown',
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  credits numeric(12, 4) NOT NULL DEFAULT 0,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT api_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON public.api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created ON public.api_usage_logs(user_id, created_at);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage logs" ON public.api_usage_logs;
CREATE POLICY "Users can view own usage logs"
  ON public.api_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Allow insert for own user_id (service role bypasses RLS)
DROP POLICY IF EXISTS "Users can insert own usage logs" ON public.api_usage_logs;
CREATE POLICY "Users can insert own usage logs"
  ON public.api_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. user_credits
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid NOT NULL,
  credit_balance numeric(12, 4) NOT NULL DEFAULT 0,
  credits_purchased numeric(12, 4) NOT NULL DEFAULT 0,
  credits_used numeric(12, 4) NOT NULL DEFAULT 0,
  monthly_credits_used numeric(12, 4) NOT NULL DEFAULT 0,
  monthly_usage_reset_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_credits_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
CREATE POLICY "Users can update own credits"
  ON public.user_credits FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credits row" ON public.user_credits;
CREATE POLICY "Users can insert own credits row"
  ON public.user_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Seed subscription_tiers
INSERT INTO public.subscription_tiers (id, name, stripe_price_id, monthly_price_cents, monthly_credit_quota, features, is_active)
VALUES
  ('free', 'Free', NULL, 0, 100, '{"prompts_per_month": 10, "icps": 1, "scans": "weekly", "analytics": "basic"}'::jsonb, true),
  ('starter', 'Starter', NULL, 4900, 1000, '{"prompts_per_month": 100, "icps": 5, "scans": "daily", "analytics": "advanced", "ai_insights": true, "support": "priority"}'::jsonb, true),
  ('pro', 'Pro', NULL, 14900, 0, '{"prompts_per_month": "unlimited", "icps": "unlimited", "scans": "realtime", "analytics": "custom", "api_access": true, "support": "dedicated", "white_label": true}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, subscription_tiers.stripe_price_id),
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  monthly_credit_quota = EXCLUDED.monthly_credit_quota,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;
