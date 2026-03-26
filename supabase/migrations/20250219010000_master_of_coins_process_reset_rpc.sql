-- Master of Coins: single RPC for processReset (lock + downgrade + expire monthly only + grant + idempotency).
-- Period columns (subscription_renewal_at, subscription_period_start_at) are Stripe-owned; RPC does not update them.
-- Caller (masterOfCoins.js) passes monthly_quota and idempotency keys; tier quota is resolved in app.

CREATE OR REPLACE FUNCTION public.master_of_coins_process_reset(
  p_profile_id uuid,
  p_monthly_quota numeric,
  p_reset_period_key text,
  p_idempotency_key_expire uuid,
  p_idempotency_key_grant uuid
)
RETURNS TABLE(ok boolean, skipped boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_work_order jsonb;
  v_pending jsonb;
  v_to_plan text;
  v_credits_remaining numeric(12, 4);
  v_new_plan text;
  v_idempotency jsonb;
BEGIN
  ok := false;
  skipped := false;
  error_message := NULL;

  -- 1. Lock profile row
  SELECT id, subscription_plan, credits_remaining, credits_reset_at, coins_work_order
  INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    error_message := 'profile_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  v_work_order := COALESCE(v_profile.coins_work_order, '{}'::jsonb);
  v_idempotency := v_work_order->'idempotency';
  IF v_idempotency IS NULL THEN
    v_idempotency := '{}'::jsonb;
  END IF;

  -- 2. Idempotency: skip if this period already processed
  IF (v_idempotency->>'last_reset_period_key') = p_reset_period_key THEN
    ok := true;
    skipped := true;
    RETURN NEXT;
    RETURN;
  END IF;

  v_new_plan := v_profile.subscription_plan;

  -- 3. Apply pending downgrade if present (no effective_at; applies at reset run)
  v_pending := v_work_order->'pending_change';
  IF v_pending IS NOT NULL AND (v_pending->>'type') = 'downgrade' THEN
    v_to_plan := v_pending->>'to_plan';
    IF v_to_plan IS NOT NULL THEN
      v_new_plan := v_to_plan;
      v_work_order := v_work_order - 'pending_change';
      UPDATE public.profiles SET subscription_plan = v_to_plan WHERE id = p_profile_id;
    END IF;
  END IF;

  v_credits_remaining := COALESCE(v_profile.credits_remaining, 0)::numeric(12, 4);

  -- 4. Expire monthly only (bucket-safe: debit exactly credits_remaining, payg untouched)
  IF v_credits_remaining > 0 THEN
    IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = p_idempotency_key_expire AND user_id = p_profile_id) THEN
      -- Already expired (replay)
      NULL;
    ELSE
      INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
      VALUES (
        p_profile_id,
        p_idempotency_key_expire,
        'monthly_expire',
        v_credits_remaining,
        v_credits_remaining,
        0,
        v_credits_remaining,
        '{"reason":"monthly_reset"}'::jsonb
      );
    END IF;
  END IF;

  -- 5. Grant full monthly credits for current plan (after downgrade if applied)
  IF p_monthly_quota IS NOT NULL AND p_monthly_quota > 0 THEN
    IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = p_idempotency_key_grant AND user_id = p_profile_id) THEN
      NULL;
    ELSE
      INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
      VALUES (
        p_profile_id,
        p_idempotency_key_grant,
        'monthly_grant',
        -p_monthly_quota,
        -p_monthly_quota,
        0,
        -p_monthly_quota,
        jsonb_build_object('reason', 'monthly_reset', 'plan', v_new_plan)
      );
    END IF;
  END IF;

  -- 6. Update work order idempotency and advance credits_reset_at
  v_idempotency := v_idempotency || jsonb_build_object(
    'last_reset_processed_at', now(),
    'last_reset_period_key', p_reset_period_key
  );
  v_work_order := COALESCE(v_work_order, '{}'::jsonb) || jsonb_build_object('version', 1, 'idempotency', v_idempotency);

  UPDATE public.profiles
  SET
    coins_work_order = v_work_order,
    credits_reset_at = COALESCE(credits_reset_at, now()) + interval '1 month'
  WHERE id = p_profile_id;

  ok := true;
  skipped := false;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.master_of_coins_process_reset IS 'Master of Coins: process one profile reset (expire monthly, grant quota, idempotency by period). Period columns are Stripe-owned; caller passes quota and idempotency keys.';
