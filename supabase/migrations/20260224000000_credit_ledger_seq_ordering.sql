-- Migration: credit_ledger seq ordering
-- Adds a BIGSERIAL `seq` column to credit_ledger as the canonical insertion-order key.
--
-- Root cause fixed: sync_ledger_balance() used ORDER BY created_at DESC, id DESC to find
-- the previous row's balance. When monthly_expire and monthly_grant are inserted in the same
-- transaction, both get the same created_at (transaction-stable now()), and the UUID tiebreaker
-- is non-deterministic. A subsequent transaction (e.g. payg_purchase) could pick the expire
-- row (balance=0) instead of the grant row (balance=1000), silently zeroing credits_remaining.
--
-- Fix: replace the ordering key with `seq BIGSERIAL`, which is strictly monotonic and reflects
-- true insertion order. This is the canonical ordering key for all future "previous row" lookups
-- on credit_ledger.

-- 1. Add seq column (BIGSERIAL fills existing rows in heap order = insertion order
--    since credit_ledger is append-only — no deletes, no row updates).
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

-- 2. Index: replaces (user_id, created_at DESC) as the lookup index for the trigger.
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_seq
  ON public.credit_ledger(user_id, seq DESC);

-- 3. Update the BEFORE INSERT trigger to ORDER BY seq DESC.
--    seq is always unique and reflects insertion order, so there can never be a tie.
CREATE OR REPLACE FUNCTION public.sync_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_m numeric(12, 4);
  v_prev_p numeric(12, 4);
BEGIN
  SELECT monthly_balance, payg_balance
  INTO v_prev_m, v_prev_p
  FROM public.credit_ledger
  WHERE user_id = NEW.user_id
  ORDER BY seq DESC   -- canonical: seq is insertion-order, never ties
  LIMIT 1;

  v_prev_m := COALESCE(v_prev_m, 0);
  v_prev_p := COALESCE(v_prev_p, 0);

  -- new_balance = prev - cost  (positive cost = debit, negative cost = credit/grant)
  NEW.monthly_balance := v_prev_m - NEW.monthly_cost;
  NEW.payg_balance    := v_prev_p - NEW.payg_cost;

  RETURN NEW;
END;
$$;

-- Trigger registration is unchanged; only the function body above changed.
DROP TRIGGER IF EXISTS trg_ledger_compute_balance ON public.credit_ledger;
CREATE TRIGGER trg_ledger_compute_balance
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_ledger_balance();

COMMENT ON COLUMN public.credit_ledger.seq IS
  'Monotonically increasing insertion-order key. Canonical ordering column for balance lookups (replaces created_at + id tiebreaker, which was non-deterministic within same-transaction inserts).';
