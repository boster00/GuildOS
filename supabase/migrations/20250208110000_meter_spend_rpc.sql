-- RPC: atomic spend + ledger insert (idempotent by idempotency_key).
-- Used by libs/monkey/tools/metering.js meterSpend().

CREATE OR REPLACE FUNCTION public.meter_spend(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_cost int,
  p_meta jsonb DEFAULT NULL
)
RETURNS TABLE(ok boolean, charged boolean, remaining integer, code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining int;
  v_row_count int;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    ok := true;
    charged := false;
    remaining := NULL;
    code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Idempotent replay: ledger already has this key
  IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
    ok := true;
    charged := false;
    remaining := v_remaining;
    code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Decrement with guard (profiles.id = user id)
  UPDATE public.profiles
  SET credits_remaining = credits_remaining - p_cost
  WHERE id = p_user_id AND credits_remaining >= p_cost;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
    ok := false;
    charged := false;
    remaining := COALESCE(v_remaining, 0);
    code := 'OUT_OF_CREDITS';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Insert ledger row
  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, p_cost, p_meta);

  SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
  ok := true;
  charged := true;
  remaining := v_remaining;
  code := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;
