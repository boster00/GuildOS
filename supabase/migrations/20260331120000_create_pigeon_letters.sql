-- Pigeon letters: async outbound/inbound work tied to quests (any external channel or worker).
-- Replaces ad-hoc storage in quests.inventory.pigeon_letters over time; apply code changes in a follow-up.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pigeon_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  quest_id uuid NOT NULL REFERENCES public.quests (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  channel text NOT NULL CHECK (char_length(btrim(channel)) > 0),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'claimed',
        'processing',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  target_item_key text,

  result jsonb,

  error_message text,

  claimed_at timestamptz,
  claimed_by text,
  lease_expires_at timestamptz,

  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),

  next_run_at timestamptz,

  correlation_id text,

  idempotency_key text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pigeon_letters IS
  'Async pigeon post: per-quest messages for external systems and workers; not quest inventory JSON.';

COMMENT ON COLUMN public.pigeon_letters.channel IS
  'Which integration or transport owns this row; set explicitly on insert (no default).';

COMMENT ON COLUMN public.pigeon_letters.payload IS
  'Opaque instructions for the channel (shape defined by that channel, not the table).';

COMMENT ON COLUMN public.pigeon_letters.claimed_by IS
  'Opaque worker or external system id (consumer name, job id, etc.).';

COMMENT ON COLUMN public.pigeon_letters.target_item_key IS
  'When delivery maps into quest inventory, the item_key to write; otherwise null.';

COMMENT ON COLUMN public.pigeon_letters.result IS
  'Outcome: delivered value, HTTP summary, worker output, etc.';

COMMENT ON COLUMN public.pigeon_letters.lease_expires_at IS
  'Stale workers may reclaim or reset rows when lease_expires_at < now().';

COMMENT ON COLUMN public.pigeon_letters.next_run_at IS
  'Optional schedule for pollers / delayed retry.';

COMMENT ON COLUMN public.pigeon_letters.idempotency_key IS
  'Per-quest dedupe for external retries; unique when set (partial index).';

COMMENT ON COLUMN public.pigeon_letters.metadata IS
  'Extensible channel tags (priority, source action, dead-letter flags, etc.).';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS pigeon_letters_quest_id_idx ON public.pigeon_letters (quest_id);

CREATE INDEX IF NOT EXISTS pigeon_letters_owner_status_idx ON public.pigeon_letters (owner_id, status);

CREATE INDEX IF NOT EXISTS pigeon_letters_channel_status_idx ON public.pigeon_letters (channel, status);

CREATE INDEX IF NOT EXISTS pigeon_letters_next_run_idx ON public.pigeon_letters (next_run_at)
  WHERE status IN ('pending', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS pigeon_letters_quest_idempotency_uidx
  ON public.pigeon_letters (quest_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pigeon_letters_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pigeon_letters_set_updated_at ON public.pigeon_letters;
CREATE TRIGGER pigeon_letters_set_updated_at
  BEFORE UPDATE ON public.pigeon_letters
  FOR EACH ROW
  EXECUTE PROCEDURE public.pigeon_letters_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.pigeon_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pigeon_letters_select_own" ON public.pigeon_letters;
DROP POLICY IF EXISTS "pigeon_letters_insert_own" ON public.pigeon_letters;
DROP POLICY IF EXISTS "pigeon_letters_update_own" ON public.pigeon_letters;
DROP POLICY IF EXISTS "pigeon_letters_delete_own" ON public.pigeon_letters;

CREATE POLICY "pigeon_letters_select_own"
  ON public.pigeon_letters
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "pigeon_letters_insert_own"
  ON public.pigeon_letters
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pigeon_letters_update_own"
  ON public.pigeon_letters
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pigeon_letters_delete_own"
  ON public.pigeon_letters
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (Supabase: service_role bypasses RLS)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pigeon_letters TO authenticated;
GRANT ALL ON TABLE public.pigeon_letters TO service_role;
