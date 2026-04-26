-- Add actor_name to item_comments and quest_comments so the UI can render
-- "Adventurer: Hairo" / "Questmaster: Cat" / "Guildmaster" instead of bare role.
-- The adventurers table already has `backstory` which serves as the purpose
-- description shown in the adventurer-selection prompt; no new column needed there.

ALTER TABLE public.item_comments
  ADD COLUMN IF NOT EXISTS actor_name text;

COMMENT ON COLUMN public.item_comments.actor_name IS
  'Human-readable name of the actor that wrote this comment (adventurer name, "Cat", "Guildmaster"). Old rows have NULL; UI falls back to bare role label.';

ALTER TABLE public.quest_comments
  ADD COLUMN IF NOT EXISTS actor_name text;

COMMENT ON COLUMN public.quest_comments.actor_name IS
  'Human-readable name of the actor on whose behalf this comment was written. Distinct from `source` (which is the writer system / weapon, e.g. "questExecution"). Old rows have NULL.';
