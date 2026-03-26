-- Per-account monthly credits reset (signup-based). When credits_reset_at <= now(), daily job grants monthly credits and sets credits_reset_at = credits_reset_at + 1 month.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_reset_at timestamptz;

COMMENT ON COLUMN public.profiles.credits_reset_at IS 'Next date when monthly credits are granted (per-account). NULL = not yet set; job may set on first grant.';
