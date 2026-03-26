-- Remove api_usage_logs. Usage and balance are in credit_ledger + profiles.
-- logUsage() in metering.js is a no-op; GET /api/usage/logs reads from credit_ledger (debit rows).
-- Idempotent: no-op if the table was never created in this project.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_usage_logs') THEN
    DROP POLICY IF EXISTS "Users can view own usage logs" ON public.api_usage_logs;
    DROP POLICY IF EXISTS "Users can insert own usage logs" ON public.api_usage_logs;
    DROP TABLE public.api_usage_logs;
  END IF;
END $$;
