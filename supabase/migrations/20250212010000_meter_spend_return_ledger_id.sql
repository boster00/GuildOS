-- Extend meter_spend to return ledger_id (for external_requests correlation).

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
  remaining_payg int,
  ledger_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monthly int;
  v_payg int;
  v_rem_m int;
  v_rem_p int;
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

  -- Idempotent replay: return existing row data including ledger id
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
