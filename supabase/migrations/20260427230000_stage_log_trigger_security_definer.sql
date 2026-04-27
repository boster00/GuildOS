-- Fix: the AFTER UPDATE trigger on quests was written without SECURITY DEFINER,
-- so it runs as the calling user's role. The user role has no INSERT policy on
-- quest_stage_log (only SELECT was granted), so any authenticated user trying
-- to update quests.stage gets:
--   "new row violates row-level security policy for table quest_stage_log"
--
-- Audit-log writes should always succeed regardless of who triggers them.
-- SECURITY DEFINER runs the function with the privileges of its owner
-- (typically `postgres`), bypassing RLS on quest_stage_log.

CREATE OR REPLACE FUNCTION public.log_quest_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.quest_stage_log (quest_id, old_stage, new_stage)
    VALUES (NEW.id, OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$;
