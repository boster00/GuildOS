-- Add session tracking columns to adventurers for live agent integration
ALTER TABLE public.adventurers
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS worker_type text NOT NULL DEFAULT 'cursor_cloud',
  ADD COLUMN IF NOT EXISTS session_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS busy_since timestamptz;

-- Add dispatch_token to quests for concurrency control
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS dispatch_token uuid;

COMMENT ON COLUMN public.adventurers.session_id IS 'Cursor agent ID (e.g. bc-xxxxxxxx) or other worker session identifier';
COMMENT ON COLUMN public.adventurers.worker_type IS 'Worker runtime type: cursor_cloud, runpod, etc.';
COMMENT ON COLUMN public.adventurers.session_status IS 'idle, raised_hand, busy, confused, error, inactive';
COMMENT ON COLUMN public.adventurers.busy_since IS 'Timestamp when status entered busy, used for confused detection';
COMMENT ON COLUMN public.quests.dispatch_token IS 'UUID generated per dispatch, used for atomic stage transitions and dedup';
