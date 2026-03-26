-- Migration: credit_ledger balance repair
-- Recomputes monthly_balance and payg_balance on all existing credit_ledger rows using the
-- correct seq ordering (from migration 20260224000000), then re-syncs profiles.credits_remaining
-- and profiles.payg_wallet from the corrected ledger.
--
-- Why this is needed: prior to the seq fix, same-transaction rows (monthly_expire, monthly_grant)
-- shared an identical created_at timestamp. The UUID tiebreaker was non-deterministic, causing
-- some rows (e.g. payg_purchase) to record the wrong running balance. This repair overwrites
-- those stale values with the correct seq-ordered running totals.
--
-- DRY strategy: a single TEMP TABLE `corrected_balances` computes the running balance formula
-- once (ORDER BY seq) and is reused by both the ledger UPDATE and the profile sync UPDATE.
-- The formula is never duplicated.

-- 1. Build corrected running balances for every ledger row.
--    The window function uses ORDER BY seq — the canonical insertion-order key.
CREATE TEMP TABLE corrected_balances AS
SELECT
  cl.id,
  cl.user_id,
  cl.seq,
  -SUM(cl.monthly_cost) OVER (PARTITION BY cl.user_id ORDER BY cl.seq) AS monthly_balance,
  -SUM(cl.payg_cost)    OVER (PARTITION BY cl.user_id ORDER BY cl.seq) AS payg_balance
FROM public.credit_ledger cl;

-- 2. Rewrite monthly_balance / payg_balance on every ledger row.
--    This corrects rows that were computed with the broken created_at+uuid ordering.
UPDATE public.credit_ledger l
SET
  monthly_balance = cb.monthly_balance,
  payg_balance    = cb.payg_balance
FROM corrected_balances cb
WHERE l.id = cb.id;

-- 3. Re-sync profiles.credits_remaining and payg_wallet from the latest (highest seq)
--    corrected balance per user.
--    Uses the same corrected_balances temp table — formula is not repeated.
UPDATE public.profiles p
SET
  credits_remaining = COALESCE(latest.monthly_balance, 0),
  payg_wallet       = COALESCE(latest.payg_balance, 0)
FROM (
  SELECT DISTINCT ON (user_id)
    user_id, monthly_balance, payg_balance
  FROM corrected_balances
  ORDER BY user_id, seq DESC
) latest
WHERE p.id = latest.user_id;

-- Temp table is session-scoped and drops automatically; explicit drop for clarity.
DROP TABLE corrected_balances;

-- Post-repair validation (informational — will appear in migration logs if run via CLI):
-- Expected: 0 rows (no seq duplicates across all users)
DO $$
DECLARE
  dupe_count int;
BEGIN
  SELECT COUNT(*) INTO dupe_count
  FROM (
    SELECT user_id, seq
    FROM public.credit_ledger
    GROUP BY user_id, seq
    HAVING COUNT(*) > 1
  ) dupes;

  IF dupe_count > 0 THEN
    RAISE WARNING 'credit_ledger_balance_repair: % seq duplicate(s) found — investigate before proceeding', dupe_count;
  ELSE
    RAISE NOTICE 'credit_ledger_balance_repair: seq uniqueness verified (0 duplicates)';
  END IF;
END;
$$;
