ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quest_stage_check;
ALTER TABLE public.quests ADD CONSTRAINT quest_stage_check
  CHECK (stage IN ('idea', 'plan', 'assign', 'execute', 'escalated', 'purrview', 'review', 'closing', 'complete', 'completed'));
