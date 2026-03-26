-- RPC: atomic grant (add credits) + ledger insert (idempotent by idempotency_key).
-- Used by set-credits, add-credits-by-email, and monthly refresh. cost in ledger is negative for grants.

CREATE OR REPLACE FUNCTION public.meter_grant(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_credit_amount int,
  p_meta jsonb DEFAULT NULL
)
RETURNS TABLE(ok boolean, granted boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF p_credit_amount IS NULL OR p_credit_amount <= 0 THEN
    SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
    ok := true;
    granted := false;
    remaining := COALESCE(v_remaining, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Idempotent replay: ledger already has this key
  IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
    ok := true;
    granted := false;
    remaining := COALESCE(v_remaining, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Add credits and insert ledger row (cost negative = credit)
  UPDATE public.profiles
  SET credits_remaining = credits_remaining + p_credit_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost, meta)
  VALUES (p_user_id, p_idempotency_key, p_action, -p_credit_amount, p_meta);

  SELECT credits_remaining INTO v_remaining FROM public.profiles WHERE id = p_user_id;
  ok := true;
  granted := true;
  remaining := COALESCE(v_remaining, 0);
  RETURN NEXT;
  RETURN;
END;
$$;
