-- Idempotency for Stripe webhooks: each event.id processed at most once.
-- Handler inserts before processing; duplicate delivery returns 200 without re-running.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text NOT NULL PRIMARY KEY,
  event_type text,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_webhook_events IS 'Stripe webhook event ids already processed; used for idempotency.';
