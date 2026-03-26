-- Test harness helpers: all use DB now() so worker and UI agree on time.
-- Used only by app/(private)/test-master-of-coins (dev-only).

-- Returns current DB timestamp (for due-status display).
CREATE OR REPLACE FUNCTION public.test_moc_get_db_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now();
$$;

COMMENT ON FUNCTION public.test_moc_get_db_now IS 'Test harness: return DB now() for due-status comparison.';

-- Ensure credits_reset_at is set: subscription_renewal_at or now() + 1 month.
CREATE OR REPLACE FUNCTION public.test_moc_ensure_credits_reset_at(p_profile_id uuid)
RETURNS TABLE(credits_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_reset_at = COALESCE(subscription_renewal_at, now() + interval '1 month')
  WHERE id = p_profile_id
    AND credits_reset_at IS NULL;

  RETURN QUERY
  SELECT p.credits_reset_at
  FROM public.profiles p
  WHERE p.id = p_profile_id;
END;
$$;

COMMENT ON FUNCTION public.test_moc_ensure_credits_reset_at IS 'Test harness: set credits_reset_at if null (DB time only).';

-- Fast-forward: subtract days with min clamp (now() - 400 days).
CREATE OR REPLACE FUNCTION public.test_moc_fast_forward_credits_reset_at(
  p_profile_id uuid,
  p_days int
)
RETURNS TABLE(credits_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 366 THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits_reset_at = GREATEST(
    credits_reset_at - (p_days || ' days')::interval,
    now() - interval '400 days'
  )
  WHERE id = p_profile_id
    AND credits_reset_at IS NOT NULL;

  RETURN QUERY
  SELECT p.credits_reset_at
  FROM public.profiles p
  WHERE p.id = p_profile_id;
END;
$$;

COMMENT ON FUNCTION public.test_moc_fast_forward_credits_reset_at IS 'Test harness: subtract days from credits_reset_at with min clamp.';

-- Preset: now, past (now - 7d), future (now + 7d).
CREATE OR REPLACE FUNCTION public.test_moc_set_credits_reset_at_preset(
  p_profile_id uuid,
  p_preset text
)
RETURNS TABLE(credits_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_preset = 'now' THEN
    UPDATE public.profiles SET credits_reset_at = now() WHERE id = p_profile_id;
  ELSIF p_preset = 'past' THEN
    UPDATE public.profiles SET credits_reset_at = now() - interval '7 days' WHERE id = p_profile_id;
  ELSIF p_preset = 'future' THEN
    UPDATE public.profiles SET credits_reset_at = now() + interval '7 days' WHERE id = p_profile_id;
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.credits_reset_at
  FROM public.profiles p
  WHERE p.id = p_profile_id;
END;
$$;

COMMENT ON FUNCTION public.test_moc_set_credits_reset_at_preset IS 'Test harness: set credits_reset_at to now / past / future (DB time).';
