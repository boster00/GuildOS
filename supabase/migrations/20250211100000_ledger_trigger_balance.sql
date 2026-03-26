-- Ledger as source of truth: balance columns + triggers. No direct profile updates from RPCs.
-- Triggers compute monthly_balance/payg_balance and sync to profiles.
-- Grants use negative cost (e.g. payg_cost=-10); drop constraints that disallow negative.

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_monthly_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_payg_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_total_cost_check;

-- 1. Add balance columns to credit_ledger
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS monthly_balance integer,
  ADD COLUMN IF NOT EXISTS payg_balance integer;

COMMENT ON COLUMN public.credit_ledger.monthly_balance IS 'Running monthly pool balance after this row. Set by trigger.';
COMMENT ON COLUMN public.credit_ledger.payg_balance IS 'Running PAYG wallet balance after this row. Set by trigger.';

-- 2. Backfill balance columns (running balance per user)
UPDATE public.credit_ledger cl
SET
  monthly_balance = sub.monthly_balance,
  payg_balance = sub.payg_balance
FROM (
  SELECT id,
    -SUM(monthly_cost) OVER (PARTITION BY user_id ORDER BY created_at, id) AS monthly_balance,
    -SUM(payg_cost) OVER (PARTITION BY user_id ORDER BY created_at, id) AS payg_balance
  FROM public.credit_ledger
) sub
WHERE cl.id = sub.id;

-- 3. Sync profiles from latest ledger balance per user (one-time catch-up)
UPDATE public.profiles p
SET
  credits_remaining = COALESCE(lat.monthly_balance, 0),
  payg_wallet = COALESCE(lat.payg_balance, 0)
FROM (
  SELECT DISTINCT ON (user_id) user_id, monthly_balance, payg_balance
  FROM public.credit_ledger
  ORDER BY user_id, created_at DESC, id DESC
) lat
WHERE p.id = lat.user_id;

-- 4. BEFORE INSERT trigger: compute monthly_balance and payg_balance on new row
CREATE OR REPLACE FUNCTION public.sync_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_m int;
  v_prev_p int;
BEGIN
  SELECT monthly_balance, payg_balance INTO v_prev_m, v_prev_p
  FROM public.credit_ledger
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_prev_m := COALESCE(v_prev_m, 0);
  v_prev_p := COALESCE(v_prev_p, 0);

  -- new_balance = prev - cost (positive cost = debit, negative = credit)
  NEW.monthly_balance := v_prev_m - NEW.monthly_cost;
  NEW.payg_balance := v_prev_p - NEW.payg_cost;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_compute_balance ON public.credit_ledger;
CREATE TRIGGER trg_ledger_compute_balance
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_ledger_balance();

-- 5. AFTER INSERT trigger: push final balance to profiles
CREATE OR REPLACE FUNCTION public.sync_ledger_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_remaining = NEW.monthly_balance,
      payg_wallet = NEW.payg_balance
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_to_profiles ON public.credit_ledger;
CREATE TRIGGER trg_ledger_to_profiles
  AFTER INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_ledger_to_profiles();

-- 6. Refactor meter_spend: INSERT only, no UPDATE profiles (trigger handles it)
DROP FUNCTION IF EXISTS public.meter_spend(uuid, uuid, text, integer, jsonb);

CREATE OR REPLACE FUNCTION public.meter_spend(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_cost int,
  p_meta jsonb DEFAULT NULL
)
RETURNS TABLE(
  ok boolean,
  charged boolean,
  remaining integer,
  code text,
  monthly_cost int,
  payg_cost int,
  remaining_monthly int,
  remaining_payg int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monthly int;
  v_payg int;
  v_rem_m int;
  v_rem_p int;
BEGIN
  monthly_cost := 0;
  payg_cost := 0;
  remaining_monthly := NULL;
  remaining_payg := NULL;

  IF p_cost IS NULL OR p_cost <= 0 THEN
    ok := true;
    charged := false;
    remaining := NULL;
    code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Idempotent replay: return existing row data
  SELECT cl.monthly_cost, cl.payg_cost, cl.monthly_balance, cl.payg_balance
  INTO v_monthly, v_payg, v_rem_m, v_rem_p
  FROM public.credit_ledger cl
  WHERE cl.idempotency_key = p_idempotency_key AND cl.user_id = p_user_id;

  IF FOUND THEN
    ok := true;
    charged := false;
    remaining := COALESCE(v_rem_m, 0) + COALESCE(v_rem_p, 0);
    code := NULL;
    monthly_cost := COALESCE(v_monthly, 0);
    payg_cost := COALESCE(v_payg, 0);
    remaining_monthly := COALESCE(v_rem_m, 0);
    remaining_payg := COALESCE(v_rem_p, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Read current balance from profiles (trigger keeps it in sync)
  SELECT p.credits_remaining, p.payg_wallet
  INTO v_rem_m, v_rem_p
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    ok := false;
    charged := false;
    remaining := 0;
    code := 'OUT_OF_CREDITS';
    RETURN NEXT;
    RETURN;
  END IF;

  v_rem_m := COALESCE(v_rem_m, 0);
  v_rem_p := COALESCE(v_rem_p, 0);

  IF v_rem_m + v_rem_p < p_cost THEN
    ok := false;
    charged := false;
    remaining := v_rem_m + v_rem_p;
    code := 'OUT_OF_CREDITS';
    remaining_monthly := v_rem_m;
    remaining_payg := v_rem_p;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Spend monthly first, then payg (INSERT only; trigger updates profiles)
  v_monthly := LEAST(v_rem_m, p_cost);
  v_payg := p_cost - v_monthly;

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, p_cost, v_monthly, v_payg, p_cost, p_meta);

  remaining_monthly := v_rem_m - v_monthly;
  remaining_payg := v_rem_p - v_payg;

  ok := true;
  charged := true;
  remaining := remaining_monthly + remaining_payg;
  code := NULL;
  monthly_cost := v_monthly;
  payg_cost := v_payg;
  RETURN NEXT;
  RETURN;
END;
$$;

-- 7. Refactor meter_grant: INSERT only with negative costs, no UPDATE profiles
DROP FUNCTION IF EXISTS public.meter_grant(uuid, uuid, text, integer, jsonb, text);

CREATE OR REPLACE FUNCTION public.meter_grant(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_credit_amount int,
  p_meta jsonb DEFAULT NULL,
  p_target text DEFAULT 'monthly'
)
RETURNS TABLE(ok boolean, granted boolean, remaining integer, remaining_monthly int, remaining_payg int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining int;
  v_rem_m int;
  v_rem_p int;
  v_meta jsonb;
  v_monthly_cost int;
  v_payg_cost int;
  v_total_cost int;
BEGIN
  remaining_monthly := NULL;
  remaining_payg := NULL;

  IF p_credit_amount IS NULL OR p_credit_amount <= 0 THEN
    SELECT credits_remaining, payg_wallet INTO v_rem_m, v_rem_p FROM public.profiles WHERE id = p_user_id;
    ok := true;
    granted := false;
    remaining := COALESCE(v_rem_m, 0) + COALESCE(v_rem_p, 0);
    remaining_monthly := COALESCE(v_rem_m, 0);
    remaining_payg := COALESCE(v_rem_p, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT credits_remaining, payg_wallet INTO v_rem_m, v_rem_p FROM public.profiles WHERE id = p_user_id;
    ok := true;
    granted := false;
    remaining := COALESCE(v_rem_m, 0) + COALESCE(v_rem_p, 0);
    remaining_monthly := COALESCE(v_rem_m, 0);
    remaining_payg := COALESCE(v_rem_p, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  v_meta := COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('target', COALESCE(NULLIF(trim(p_target), ''), 'monthly'));

  -- Grants use negative cost: payg_cost=-10 means +10 to payg wallet
  IF COALESCE(lower(trim(p_target)), 'monthly') = 'payg' THEN
    v_monthly_cost := 0;
    v_payg_cost := -p_credit_amount;
  ELSE
    v_monthly_cost := -p_credit_amount;
    v_payg_cost := 0;
  END IF;
  v_total_cost := v_monthly_cost + v_payg_cost;

  -- INSERT only; trigger updates profiles
  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, v_total_cost, v_monthly_cost, v_payg_cost, v_total_cost, v_meta);

  SELECT credits_remaining, payg_wallet INTO v_rem_m, v_rem_p FROM public.profiles WHERE id = p_user_id;
  v_remaining := COALESCE(v_rem_m, 0) + COALESCE(v_rem_p, 0);

  ok := true;
  granted := true;
  remaining := v_remaining;
  remaining_monthly := COALESCE(v_rem_m, 0);
  remaining_payg := COALESCE(v_rem_p, 0);
  RETURN NEXT;
  RETURN;
END;
$$;

-- 8. meter_reset: zero account via ledger (for tests). Inserts row that zeros both pools.
CREATE OR REPLACE FUNCTION public.meter_reset(p_user_id uuid)
RETURNS TABLE(ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_m int;
  v_p int;
BEGIN
  SELECT credits_remaining, payg_wallet INTO v_m, v_p
  FROM public.profiles WHERE id = p_user_id;

  v_m := COALESCE(v_m, 0);
  v_p := COALESCE(v_p, 0);

  IF v_m = 0 AND v_p = 0 THEN
    ok := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Insert row: monthly_cost=-v_m, payg_cost=-v_p zeros both pools
  -- Trigger computes new balance = prev - cost = prev - (-prev) = 0
  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, gen_random_uuid(), 'test_reset', -(v_m + v_p), -v_m, -v_p, -(v_m + v_p), '{"reason":"test_reset"}'::jsonb);

  ok := true;
  RETURN NEXT;
  RETURN;
END;
$$;
