ALTER TABLE public.adventurers
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;

COMMENT ON COLUMN public.adventurers.last_nudged_at IS 'Last time the cron nudged this adventurer about being idle with active quests';
