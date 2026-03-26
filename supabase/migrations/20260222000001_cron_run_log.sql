-- Lightweight cron run log for test-production page Step 4 evidence.
-- Credit-reset worker writes one global row per job run and one per-account row per processed user.

CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name  text        NOT NULL,
  ran_at    timestamptz NOT NULL DEFAULT now(),
  status    text        NOT NULL CHECK (status IN ('ok', 'error', 'skipped')),
  user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  meta      jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cron_run_log_ran_at_idx
  ON public.cron_run_log (ran_at DESC);

CREATE INDEX IF NOT EXISTS cron_run_log_user_idx
  ON public.cron_run_log (user_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS cron_run_log_job_ran_idx
  ON public.cron_run_log (job_name, ran_at DESC);

-- RLS: service role only (test-production route uses service role to read logs).
ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.cron_run_log
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true);
