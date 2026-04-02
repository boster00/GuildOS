-- Deferred work queue: first entry is popped when parent reaches stage closing (spawns child quest).
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS next_steps jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.quests.next_steps IS
  'Ordered follow-on steps; advanceClosing pops the head and creates a child quest carrying the tail.';
