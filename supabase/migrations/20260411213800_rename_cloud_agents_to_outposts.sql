-- Rename cloud_agents → outposts
ALTER TABLE public.cloud_agents RENAME TO outposts;

-- Rename indexes
ALTER INDEX cloud_agents_user_id_idx    RENAME TO outposts_user_id_idx;
ALTER INDEX cloud_agents_provider_idx   RENAME TO outposts_provider_idx;
ALTER INDEX cloud_agents_session_id_idx RENAME TO outposts_session_id_idx;
ALTER INDEX cloud_agents_status_idx     RENAME TO outposts_status_idx;

-- Rename trigger
ALTER TRIGGER cloud_agents_updated_at ON public.outposts RENAME TO outposts_updated_at;

-- Rename RLS policies
ALTER POLICY "cloud_agents_select_own" ON public.outposts RENAME TO "outposts_select_own";
ALTER POLICY "cloud_agents_insert_own" ON public.outposts RENAME TO "outposts_insert_own";
ALTER POLICY "cloud_agents_update_own" ON public.outposts RENAME TO "outposts_update_own";
ALTER POLICY "cloud_agents_delete_own" ON public.outposts RENAME TO "outposts_delete_own";

-- Update comments
COMMENT ON TABLE public.outposts IS
  'Registry of cloud coding agent outposts (Cursor, Claude, Codex, etc.). Each row is a remote agent session.';
