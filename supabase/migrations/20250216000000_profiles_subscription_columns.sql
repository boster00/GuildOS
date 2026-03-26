-- Add one column to profiles: subscription plan name (free, starter, pro). Tier definitions live in code (libs/monkey/registry/subscriptionTiers.js).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN subscription_tier_id TO subscription_plan;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_plan text;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.subscription_plan IS 'Subscription plan: free, starter, or pro (see libs/monkey/registry/subscriptionTiers.js).';
