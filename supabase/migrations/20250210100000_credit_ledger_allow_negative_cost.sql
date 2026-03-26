-- Allow negative cost in credit_ledger: cost > 0 = debit (spend), cost < 0 = credit (grant).
-- Balance = initial - sum(cost) so negative cost increases balance.

ALTER TABLE public.credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_cost_check;

COMMENT ON COLUMN public.credit_ledger.cost IS 'Debit (spend) when positive; credit (grant) when negative. Balance = initial - sum(cost).';
