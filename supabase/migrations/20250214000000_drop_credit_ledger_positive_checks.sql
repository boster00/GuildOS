-- Allow negative monthly_cost and payg_cost for grant rows (credits added to pool/wallet).
-- Spend rows use positive cost; grant rows use negative cost. Drop the >= 0 checks.

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_monthly_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_payg_cost_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_total_cost_check;
