-- Pay-as-you-go wallet: profiles.payg_wallet + ledger split (monthly_cost, payg_cost, total_cost).
-- Spend uses monthly pool first, then payg_wallet. payg_wallet does not expire.

-- 1. Profiles: add payg_wallet
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payg_wallet integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.payg_wallet IS 'Pay-as-you-go credits; do not expire. Manual top-ups and test-metering add here.';

-- 2. Credit ledger: add split columns
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS monthly_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payg_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost integer;

COMMENT ON COLUMN public.credit_ledger.monthly_cost IS 'Credits taken from monthly pool (credits_remaining) for this row.';
COMMENT ON COLUMN public.credit_ledger.payg_cost IS 'Credits taken from payg_wallet for this row.';
COMMENT ON COLUMN public.credit_ledger.total_cost IS 'Total debit for spend rows: monthly_cost + payg_cost. NULL for legacy rows; use COALESCE(total_cost, cost) in reads.';

-- 3. Backfill existing rows
UPDATE public.credit_ledger
SET
  monthly_cost = CASE WHEN cost > 0 THEN cost ELSE 0 END,
  payg_cost = 0,
  total_cost = CASE WHEN cost > 0 THEN cost ELSE 0 END
WHERE total_cost IS NULL;

-- 4. Constrain new data: for rows with total_cost set, enforce split consistency
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_monthly_cost_check CHECK (monthly_cost >= 0),
  ADD CONSTRAINT credit_ledger_payg_cost_check CHECK (payg_cost >= 0);

-- total_cost check: when not null, total_cost = monthly_cost + payg_cost (allows grant rows with 0+0=0)
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_total_cost_check CHECK (
    total_cost IS NULL OR (total_cost >= 0 AND total_cost = monthly_cost + payg_cost)
  );

-- 5. Replace meter_spend: spend monthly first, then payg; record split in ledger
-- Must DROP first because return type changed (added monthly_cost, payg_cost, remaining_monthly, remaining_payg)
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
  v_row record;
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
  SELECT cl.monthly_cost, cl.payg_cost, p.credits_remaining, p.payg_wallet
  INTO v_monthly, v_payg, v_rem_m, v_rem_p
  FROM public.credit_ledger cl
  JOIN public.profiles p ON p.id = cl.user_id
  WHERE cl.idempotency_key = p_idempotency_key AND cl.user_id = p_user_id;

  IF FOUND THEN
    ok := true;
    charged := false;
    remaining := v_rem_m + v_rem_p;
    code := NULL;
    monthly_cost := COALESCE(v_monthly, 0);
    payg_cost := COALESCE(v_payg, 0);
    remaining_monthly := v_rem_m;
    remaining_payg := v_rem_p;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Compute split and check balance in one go (lock profile row)
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

  -- Spend monthly first, then payg
  v_monthly := LEAST(v_rem_m, p_cost);
  v_payg := p_cost - v_monthly;

  UPDATE public.profiles
  SET
    credits_remaining = credits_remaining - v_monthly,
    payg_wallet = payg_wallet - v_payg
  WHERE id = p_user_id;

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, p_cost, v_monthly, v_payg, p_cost, p_meta);

  SELECT credits_remaining, payg_wallet INTO v_rem_m, v_rem_p FROM public.profiles WHERE id = p_user_id;

  ok := true;
  charged := true;
  remaining := v_rem_m + v_rem_p;
  code := NULL;
  monthly_cost := v_monthly;
  payg_cost := v_payg;
  remaining_monthly := v_rem_m;
  remaining_payg := v_rem_p;
  RETURN NEXT;
  RETURN;
END;
$$;

-- 6. Replace meter_grant: add p_target to grant to monthly or payg
-- Must DROP first because signature changed (added p_target) and return type changed (added remaining_monthly, remaining_payg)
DROP FUNCTION IF EXISTS public.meter_grant(uuid, uuid, text, integer, jsonb);

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
    UPDATE public.profiles
    SET payg_wallet = payg_wallet + p_credit_amount
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET credits_remaining = credits_remaining + p_credit_amount
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, monthly_cost, payg_cost, total_cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, -p_credit_amount, 0, 0, 0, v_meta);

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
