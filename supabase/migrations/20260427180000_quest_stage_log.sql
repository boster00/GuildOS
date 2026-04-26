-- Stage-transition audit log. Every UPDATE to quests.stage writes a row here so
-- we can detect bypass attempts (stage changed without a corresponding gate
-- comment from questExecution / questPurrview / questReview).
--
-- v1 is observe-only (does not block). A future v2 can layer a BEFORE UPDATE
-- trigger that rejects direct writes unless a session var set by an RPC gate
-- function is present.

CREATE TABLE IF NOT EXISTS public.quest_stage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.quests (id) ON DELETE CASCADE,
  old_stage text,
  new_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quest_stage_log IS
  'Every quests.stage UPDATE writes a row here. Use this + quest_comments to detect gate-bypass attempts (stage change without a corresponding source IN (questExecution, questPurrview, questReview) comment within ~few seconds).';

CREATE INDEX IF NOT EXISTS quest_stage_log_quest_id_idx
  ON public.quest_stage_log (quest_id, changed_at DESC);

-- Trigger function: log every stage change.
CREATE OR REPLACE FUNCTION public.log_quest_stage_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.quest_stage_log (quest_id, old_stage, new_stage)
    VALUES (NEW.id, OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quests_log_stage_change ON public.quests;
CREATE TRIGGER quests_log_stage_change
  AFTER UPDATE ON public.quests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quest_stage_change();

-- Permissions: same shape as the items table — service role full access,
-- authenticated read-only (so the GM desk / audit views can query).
ALTER TABLE public.quest_stage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_log_select_own" ON public.quest_stage_log;
CREATE POLICY "stage_log_select_own"
  ON public.quest_stage_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quests q
    WHERE q.id = quest_stage_log.quest_id AND q.owner_id = auth.uid()
  ));

GRANT SELECT ON TABLE public.quest_stage_log TO authenticated;
GRANT ALL ON TABLE public.quest_stage_log TO service_role;
