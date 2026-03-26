-- Diagnostic log events: temporary production diagnostic logging (gated by PRODUCTION_LOG_TOGGLE).
-- Global retention cap 10,000 rows; cleanup runs from monkey.diag.cleanup().

CREATE TABLE IF NOT EXISTS public.diag_log_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  deploy_id text,
  source text NOT NULL,
  level text NOT NULL,
  request_id text,
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS diag_log_events_ts_idx ON public.diag_log_events (ts DESC);
CREATE INDEX IF NOT EXISTS diag_log_events_request_id_idx ON public.diag_log_events (request_id);
CREATE INDEX IF NOT EXISTS diag_log_events_source_ts_idx ON public.diag_log_events (source, ts DESC);

COMMENT ON TABLE public.diag_log_events IS 'Diagnostic log events; retention cap 10,000. Cleanup via monkey.diag.cleanup().';

-- RPC for retention cleanup (stable under concurrent inserts)
CREATE OR REPLACE FUNCTION public.diag_log_events_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.diag_log_events
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id FROM public.diag_log_events
      ORDER BY ts DESC
      LIMIT 10000
    ) t
  );
$$;
