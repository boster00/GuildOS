-- Credits as numeric: allow fractional costs (e.g. 0.2). Fixes "invalid input syntax for type integer: \"0.2\"".
-- Grant rows use negative cost (monthly_cost < 0 or payg_cost < 0); drop positive-only checks.

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_monthly_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_payg_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_total_cost_check;

-- 1. Profiles: credits_remaining, payg_wallet
ALTER TABLE public.profiles
  ALTER COLUMN credits_remaining TYPE numeric(12, 4) USING credits_remaining::numeric(12, 4),
  ALTER COLUMN payg_wallet TYPE numeric(12, 4) USING payg_wallet::numeric(12, 4);

-- 2. credit_ledger: cost and split columns (monthly_balance/payg_balance only if they exist)
ALTER TABLE public.credit_ledger
  ALTER COLUMN cost TYPE numeric(12, 4) USING cost::numeric(12, 4),
  ALTER COLUMN monthly_cost TYPE numeric(12, 4) USING monthly_cost::numeric(12, 4),
  ALTER COLUMN payg_cost TYPE numeric(12, 4) USING payg_cost::numeric(12, 4),
  ALTER COLUMN total_cost TYPE numeric(12, 4) USING total_cost::numeric(12, 4);

-- 2b. Add monthly_balance and payg_balance if missing (ledger running balance)
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS monthly_balance numeric(12, 4),
  ADD COLUMN IF NOT EXISTS payg_balance numeric(12, 4);

COMMENT ON COLUMN public.credit_ledger.monthly_balance IS 'Running monthly pool balance after this row. Set by trigger.';
COMMENT ON COLUMN public.credit_ledger.payg_balance IS 'Running PAYG wallet balance after this row. Set by trigger.';

-- 2c. Alter balance columns to numeric if they existed as integer
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'monthly_balance' AND data_type = 'integer') THEN
    EXECUTE 'ALTER TABLE public.credit_ledger ALTER COLUMN monthly_balance TYPE numeric(12, 4) USING monthly_balance::numeric(12, 4)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'payg_balance' AND data_type = 'integer') THEN
    EXECUTE 'ALTER TABLE public.credit_ledger ALTER COLUMN payg_balance TYPE numeric(12, 4) USING payg_balance::numeric(12, 4)';
  END IF;
END $$;

-- 2d. Backfill running balance per user (only where NULL)
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

-- 2e. Sync profiles from latest ledger balance per user
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

-- 3. Trigger: sync_ledger_balance (use numeric)
CREATE OR REPLACE FUNCTION public.sync_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_m numeric(12, 4);
  v_prev_p numeric(12, 4);
BEGIN
  SELECT monthly_balance, payg_balance INTO v_prev_m, v_prev_p
  FROM public.credit_ledger
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_prev_m := COALESCE(v_prev_m, 0);
  v_prev_p := COALESCE(v_prev_p, 0);

  NEW.monthly_balance := v_prev_m - NEW.monthly_cost;
  NEW.payg_balance := v_prev_p - NEW.payg_cost;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_compute_balance ON public.credit_ledger;
CREATE TRIGGER trg_ledger_compute_balance
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_ledger_balance();

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

-- 4. meter_spend: accept and return numeric
DROP FUNCTION IF EXISTS public.meter_spend(uuid, uuid, text, integer, jsonb);
DROP FUNCTION IF EXISTS public.meter_spend(uuid, uuid, text, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.meter_spend(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_cost numeric,
  p_meta jsonb DEFAULT NULL
)
RETURNS TABLE(
  ok boolean,
  charged boolean,
  remaining numeric,
  code text,
  monthly_cost numeric,
  payg_cost numeric,
  remaining_monthly numeric,
  remaining_payg numeric,
  ledger_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monthly numeric(12, 4);
  v_payg numeric(12, 4);
  v_rem_m numeric(12, 4);
  v_rem_p numeric(12, 4);
  v_ledger_id uuid;
BEGIN
  monthly_cost := 0;
  payg_cost := 0;
  remaining_monthly := NULL;
  remaining_payg := NULL;
  ledger_id := NULL;

  IF p_cost IS NULL OR p_cost <= 0 THEN
    ok := true;
    charged := false;
    remaining := NULL;
    code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT cl.id, cl.monthly_cost, cl.payg_cost, cl.monthly_balance, cl.payg_balance
  INTO v_ledger_id, v_monthly, v_payg, v_rem_m, v_rem_p
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
    ledger_id := v_ledger_id;
    RETURN NEXT;
    RETURN;
  END IF;

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

  v_monthly := LEAST(v_rem_m, p_cost);
  v_payg := p_cost - v_monthly;

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, p_cost, v_monthly, v_payg, p_cost, p_meta)
  RETURNING id INTO v_ledger_id;

  remaining_monthly := v_rem_m - v_monthly;
  remaining_payg := v_rem_p - v_payg;

  ok := true;
  charged := true;
  remaining := remaining_monthly + remaining_payg;
  code := NULL;
  monthly_cost := v_monthly;
  payg_cost := v_payg;
  ledger_id := v_ledger_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- 5. meter_grant: accept and return numeric
DROP FUNCTION IF EXISTS public.meter_grant(uuid, uuid, text, integer, jsonb, text);
DROP FUNCTION IF EXISTS public.meter_grant(uuid, uuid, text, numeric, jsonb, text);

CREATE OR REPLACE FUNCTION public.meter_grant(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_credit_amount numeric,
  p_meta jsonb DEFAULT NULL,
  p_target text DEFAULT 'monthly'
)
RETURNS TABLE(ok boolean, granted boolean, remaining numeric, remaining_monthly numeric, remaining_payg numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining numeric(12, 4);
  v_rem_m numeric(12, 4);
  v_rem_p numeric(12, 4);
  v_meta jsonb;
  v_monthly_cost numeric(12, 4);
  v_payg_cost numeric(12, 4);
  v_total_cost numeric(12, 4);
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

  IF COALESCE(lower(trim(p_target)), 'monthly') = 'payg' THEN
    v_monthly_cost := 0;
    v_payg_cost := -p_credit_amount;
  ELSE
    v_monthly_cost := -p_credit_amount;
    v_payg_cost := 0;
  END IF;
  v_total_cost := v_monthly_cost + v_payg_cost;

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

-- 6. meter_reset: use numeric
CREATE OR REPLACE FUNCTION public.meter_reset(p_user_id uuid)
RETURNS TABLE(ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_m numeric(12, 4);
  v_p numeric(12, 4);
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

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, gen_random_uuid(), 'test_reset', -(v_m + v_p), -v_m, -v_p, -(v_m + v_p), '{"reason":"test_reset"}'::jsonb);

  ok := true;
  RETURN NEXT;
  RETURN;
END;
$$;
