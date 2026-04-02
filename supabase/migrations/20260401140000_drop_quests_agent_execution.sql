-- Replaced by execution_plan (ordered skill book steps). Trace/history lives in quest_comments / inventory.
ALTER TABLE public.quests
  DROP COLUMN IF EXISTS agent_execution;
