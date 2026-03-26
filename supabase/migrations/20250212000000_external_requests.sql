-- External requests: journal for credit-cost external API calls (debugging, concurrency gating).
-- profile_id uses profiles(id) — same user identity as ledger/projects.

CREATE TABLE IF NOT EXISTS public.external_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ledger_id uuid NOT NULL REFERENCES public.credit_ledger(id) ON DELETE CASCADE,
  provider text NOT NULL,
  operation text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  response_preview text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  idempotency_key text,
  latency_ms int
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_requests_idempotency_key
  ON public.external_requests(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_external_requests_profile_status
  ON public.external_requests(profile_id, status);

CREATE INDEX IF NOT EXISTS idx_external_requests_created_at
  ON public.external_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_external_requests_ledger_id
  ON public.external_requests(ledger_id);

COMMENT ON TABLE public.external_requests IS 'Journal of credit-cost external API calls for debugging and concurrency gating. Purge after 30 days.';
