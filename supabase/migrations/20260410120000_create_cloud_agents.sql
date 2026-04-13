-- Cloud Agents: registry and session tracking for external cloud coding agents
-- Supports providers: cursor, claude, codex (openai), and future additions.

CREATE TABLE IF NOT EXISTS public.cloud_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Provider identity
  provider      text NOT NULL,                -- 'cursor' | 'claude' | 'codex'
  name          text,                         -- optional friendly label

  -- Provider-side identifiers
  session_id    text,                         -- provider's session / agent run ID
  run_id        text,                         -- secondary run ID (e.g. Codex follow-up response ID)

  -- Source context (mainly for Cursor)
  repository    text,                         -- GitHub HTTPS URL of target repo
  ref           text,                         -- branch / ref

  -- State
  status        text NOT NULL DEFAULT 'active',  -- active | completed | failed | cancelled
  view_url      text,                             -- deep-link into provider web UI

  -- Flexible per-provider payload (last known response, metadata, etc.)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cloud_agents_updated_at
  BEFORE UPDATE ON public.cloud_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS cloud_agents_user_id_idx      ON public.cloud_agents(user_id);
CREATE INDEX IF NOT EXISTS cloud_agents_provider_idx     ON public.cloud_agents(provider);
CREATE INDEX IF NOT EXISTS cloud_agents_session_id_idx   ON public.cloud_agents(session_id);
CREATE INDEX IF NOT EXISTS cloud_agents_status_idx       ON public.cloud_agents(status);

-- RLS: each user can only see and manage their own agents
ALTER TABLE public.cloud_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cloud_agents_select_own" ON public.cloud_agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cloud_agents_insert_own" ON public.cloud_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cloud_agents_update_own" ON public.cloud_agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cloud_agents_delete_own" ON public.cloud_agents
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.cloud_agents IS
  'Registry of cloud coding agent sessions (Cursor, Claude Managed Agents, OpenAI Codex, etc.).';
COMMENT ON COLUMN public.cloud_agents.provider    IS 'Provider slug: cursor | claude | codex';
COMMENT ON COLUMN public.cloud_agents.session_id  IS 'Provider-issued session or agent run ID';
COMMENT ON COLUMN public.cloud_agents.run_id      IS 'Secondary run ID for providers that separate session from run (e.g. Codex follow-up response ID)';
COMMENT ON COLUMN public.cloud_agents.status      IS 'active | completed | failed | cancelled';
COMMENT ON COLUMN public.cloud_agents.metadata    IS 'Provider-specific payload: last response snapshot, tags, custom fields';
