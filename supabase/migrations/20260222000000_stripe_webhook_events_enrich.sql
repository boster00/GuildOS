-- Enrich stripe_webhook_events with thin top-level columns for fast per-user queries
-- and optional event_data JSONB for debugging (nulled after 30 days to limit storage).

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_type            text,
  ADD COLUMN IF NOT EXISTS stripe_created_at     timestamptz,
  ADD COLUMN IF NOT EXISTS livemode              boolean,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id     text,
  ADD COLUMN IF NOT EXISTS user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_data            jsonb;

-- Backfill event_type from the existing event_type column (already present in some rows)
-- No-op if the column was freshly added with no data.

CREATE INDEX IF NOT EXISTS stripe_webhook_events_user_id_idx
  ON public.stripe_webhook_events (user_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_customer_idx
  ON public.stripe_webhook_events (stripe_customer_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_subscription_idx
  ON public.stripe_webhook_events (stripe_subscription_id, processed_at DESC);

-- Retention: null event_data after 30 days to limit storage.
-- Idempotency rows (event_id) are kept forever.
CREATE OR REPLACE FUNCTION public.stripe_webhook_events_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stripe_webhook_events
  SET event_data = NULL
  WHERE processed_at < now() - INTERVAL '30 days'
    AND event_data IS NOT NULL;
$$;
