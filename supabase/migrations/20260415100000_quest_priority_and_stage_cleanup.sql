-- Add priority field to quests
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN public.quests.priority IS 'high, medium, low — agents work highest priority first';

-- Update stage constraint to include new stages
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quest_stage_check;
ALTER TABLE public.quests ADD CONSTRAINT quest_stage_check
  CHECK (stage IN ('idea', 'plan', 'assign', 'execute', 'escalated', 'review', 'closing', 'complete', 'completed'));

-- Migrate any quests in old stages to execute or complete
UPDATE public.quests SET stage = 'execute' WHERE stage IN ('idea', 'plan', 'assign');
UPDATE public.quests SET stage = 'complete' WHERE stage = 'completed';
