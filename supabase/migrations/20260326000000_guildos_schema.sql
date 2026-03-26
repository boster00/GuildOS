-- GuildOS domain schema (isolated from legacy public tables).
-- Identity: platform JWT auth remains canonical; guildos.users extends auth.users.
--
-- After applying: in the project dashboard (API settings) expose the `guildos`
-- schema so PostgREST accepts Accept-Profile / Content-Profile for .schema('guildos').

CREATE SCHEMA IF NOT EXISTS guildos;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE guildos.request_status AS ENUM (
    'draft', 'submitted', 'routed', 'planned', 'cancelled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE guildos.quest_status AS ENUM (
    'draft', 'open', 'claimed', 'in_progress', 'blocked', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE guildos.plan_status AS ENUM (
    'draft', 'ready', 'executing', 'paused', 'succeeded', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE guildos.escalation_status AS ENUM (
    'open', 'triaged', 'resolved', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE guildos.message_status AS ENUM (
    'queued', 'sending', 'sent', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE guildos.dev_task_status AS ENUM (
    'todo', 'in_progress', 'blocked', 'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Auth extension (app-level; JWT sessions remain in auth schema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_users_updated_at_idx ON guildos.users (updated_at DESC);

CREATE TABLE IF NOT EXISTS guildos.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  label TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS guildos_sessions_user_id_idx ON guildos.sessions (user_id);
CREATE INDEX IF NOT EXISTS guildos_sessions_last_seen_idx ON guildos.sessions (last_seen_at DESC);

COMMENT ON TABLE guildos.users IS 'App profile row keyed to auth.users; one row per authenticated user.';
COMMENT ON TABLE guildos.sessions IS 'Optional app session audit; hosted auth session is still authoritative for v1.';

-- ---------------------------------------------------------------------------
-- 2) Characters / mascots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  role_hint TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guildos.character_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES guildos.characters (id) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL DEFAULT 'portrait',
  storage_path TEXT,
  public_url TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_character_assets_character_id_idx
  ON guildos.character_assets (character_id);

-- ---------------------------------------------------------------------------
-- 3) Town navigation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  route_path TEXT NOT NULL,
  map_x NUMERIC,
  map_y NUMERIC,
  icon_key TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guildos.location_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location_id UUID REFERENCES guildos.locations (id) ON DELETE CASCADE,
  to_location_id UUID NOT NULL REFERENCES guildos.locations (id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_location_routes_from_idx ON guildos.location_routes (from_location_id);
CREATE INDEX IF NOT EXISTS guildos_location_routes_to_idx ON guildos.location_routes (to_location_id);

-- ---------------------------------------------------------------------------
-- 4) Quest intake
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status guildos.request_status NOT NULL DEFAULT 'submitted',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_requests_user_id_idx ON guildos.requests (user_id);
CREATE INDEX IF NOT EXISTS guildos_requests_status_idx ON guildos.requests (status);

CREATE TABLE IF NOT EXISTS guildos.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  request_id UUID REFERENCES guildos.requests (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status guildos.quest_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_quests_user_id_idx ON guildos.quests (user_id);
CREATE INDEX IF NOT EXISTS guildos_quests_status_idx ON guildos.quests (status);

-- ---------------------------------------------------------------------------
-- 5) Planning / War Room
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.quest_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES guildos.quests (id) ON DELETE CASCADE,
  status guildos.plan_status NOT NULL DEFAULT 'draft',
  strategy_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_quest_plans_quest_id_idx ON guildos.quest_plans (quest_id);

CREATE TABLE IF NOT EXISTS guildos.quest_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES guildos.quest_plans (id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  tool_refs JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_quest_steps_plan_id_idx ON guildos.quest_steps (plan_id);

CREATE TABLE IF NOT EXISTS guildos.success_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES guildos.quest_plans (id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_success_criteria_plan_id_idx ON guildos.success_criteria (plan_id);

-- ---------------------------------------------------------------------------
-- 6) Adventurers / workers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.adventurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_adventurers_user_id_idx ON guildos.adventurers (user_id);

CREATE TABLE IF NOT EXISTS guildos.adventurer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adventurer_id UUID NOT NULL REFERENCES guildos.adventurers (id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES guildos.quests (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  UNIQUE (adventurer_id, quest_id)
);

CREATE INDEX IF NOT EXISTS guildos_adventurer_assignments_quest_idx ON guildos.adventurer_assignments (quest_id);

-- ---------------------------------------------------------------------------
-- 7) Hats / roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.hats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guildos.hat_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hat_id UUID NOT NULL REFERENCES guildos.hats (id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (hat_id, capability_key)
);

CREATE INDEX IF NOT EXISTS guildos_hat_capabilities_hat_id_idx ON guildos.hat_capabilities (hat_id);

-- ---------------------------------------------------------------------------
-- 8) Smith / tooling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.weapons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tool_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guildos.tool_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weapon_id UUID NOT NULL REFERENCES guildos.weapons (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_tool_integrations_weapon_id_idx ON guildos.tool_integrations (weapon_id);

CREATE TABLE IF NOT EXISTS guildos.tool_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_integration_id UUID NOT NULL REFERENCES guildos.tool_integrations (id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  UNIQUE (tool_integration_id, permission_key)
);

-- ---------------------------------------------------------------------------
-- 9) Apothecary / credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.potions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_potions_user_id_idx ON guildos.potions (user_id);
CREATE INDEX IF NOT EXISTS guildos_potions_expires_at_idx ON guildos.potions (expires_at);

CREATE TABLE IF NOT EXISTS guildos.credential_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  potion_id UUID NOT NULL REFERENCES guildos.potions (id) ON DELETE CASCADE,
  token_ref TEXT NOT NULL,
  ciphertext_hint TEXT,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_credential_tokens_potion_id_idx ON guildos.credential_tokens (potion_id);

-- ---------------------------------------------------------------------------
-- 10) Shields / safeguards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.shields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guildos.safeguard_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shield_id UUID NOT NULL REFERENCES guildos.shields (id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_safeguard_rules_shield_id_idx ON guildos.safeguard_rules (shield_id);

-- ---------------------------------------------------------------------------
-- 11) Tavern / quest board
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.quest_board_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES guildos.quests (id) ON DELETE CASCADE,
  board_slot TEXT NOT NULL DEFAULT 'open',
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quest_id, board_slot)
);

CREATE INDEX IF NOT EXISTS guildos_quest_board_entries_slot_idx ON guildos.quest_board_entries (board_slot);

CREATE TABLE IF NOT EXISTS guildos.quest_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES guildos.quests (id) ON DELETE CASCADE,
  from_status guildos.quest_status,
  to_status guildos.quest_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_quest_status_history_quest_id_idx ON guildos.quest_status_history (quest_id);

-- ---------------------------------------------------------------------------
-- 12) Scribe / logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.scribe_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES guildos.users (id) ON DELETE SET NULL,
  quest_id UUID REFERENCES guildos.quests (id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_scribe_logs_quest_id_idx ON guildos.scribe_logs (quest_id);
CREATE INDEX IF NOT EXISTS guildos_scribe_logs_created_at_idx ON guildos.scribe_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS guildos.run_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID REFERENCES guildos.quests (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  uri TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_run_artifacts_quest_id_idx ON guildos.run_artifacts (quest_id);

CREATE TABLE IF NOT EXISTS guildos.quest_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES guildos.quests (id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_quest_reports_quest_id_idx ON guildos.quest_reports (quest_id);

-- ---------------------------------------------------------------------------
-- 13) Messenger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_notification_channels_user_id_idx ON guildos.notification_channels (user_id);

CREATE TABLE IF NOT EXISTS guildos.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  channel_id UUID REFERENCES guildos.notification_channels (id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status guildos.message_status NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS guildos_messages_user_id_idx ON guildos.messages (user_id);
CREATE INDEX IF NOT EXISTS guildos_messages_status_idx ON guildos.messages (status);

CREATE TABLE IF NOT EXISTS guildos.delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES guildos.messages (id) ON DELETE CASCADE,
  attempt_no INT NOT NULL DEFAULT 1,
  result TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_delivery_attempts_message_id_idx ON guildos.delivery_attempts (message_id);

-- ---------------------------------------------------------------------------
-- 14) Consul / escalation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID REFERENCES guildos.quests (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES guildos.users (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status guildos.escalation_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS guildos_escalations_user_id_idx ON guildos.escalations (user_id);
CREATE INDEX IF NOT EXISTS guildos_escalations_status_idx ON guildos.escalations (status);

CREATE TABLE IF NOT EXISTS guildos.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID REFERENCES guildos.escalations (id) ON DELETE CASCADE,
  quest_id UUID REFERENCES guildos.quests (id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_approval_requests_escalation_idx ON guildos.approval_requests (escalation_id);

-- ---------------------------------------------------------------------------
-- 15) Dev tasks (internal sidebar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guildos.dev_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status guildos.dev_task_status NOT NULL DEFAULT 'todo',
  sort_order INT NOT NULL DEFAULT 0,
  module_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guildos_dev_tasks_status_idx ON guildos.dev_tasks (status);
CREATE INDEX IF NOT EXISTS guildos_dev_tasks_sort_idx ON guildos.dev_tasks (sort_order);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE guildos.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quest_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quest_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.success_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.adventurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.adventurer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.potions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.credential_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.scribe_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.run_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quest_reports ENABLE ROW LEVEL SECURITY;

-- Reference / catalog tables: readable by any authenticated user
ALTER TABLE guildos.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.character_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.location_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.hats ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.hat_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.tool_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.tool_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.safeguard_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quest_board_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.quest_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE guildos.dev_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY guildos_users_select_self ON guildos.users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY guildos_users_update_self ON guildos.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY guildos_users_insert_self ON guildos.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY guildos_sessions_all_self ON guildos.sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_requests_all_self ON guildos.requests FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_quests_all_self ON guildos.quests FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_quest_plans_self ON guildos.quest_plans FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

CREATE POLICY guildos_quest_steps_self ON guildos.quest_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guildos.quest_plans p
      JOIN guildos.quests q ON q.id = p.quest_id
      WHERE p.id = plan_id AND q.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM guildos.quest_plans p
      JOIN guildos.quests q ON q.id = p.quest_id
      WHERE p.id = plan_id AND q.user_id = auth.uid()
    )
  );

CREATE POLICY guildos_success_criteria_self ON guildos.success_criteria FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guildos.quest_plans p
      JOIN guildos.quests q ON q.id = p.quest_id
      WHERE p.id = plan_id AND q.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM guildos.quest_plans p
      JOIN guildos.quests q ON q.id = p.quest_id
      WHERE p.id = plan_id AND q.user_id = auth.uid()
    )
  );

CREATE POLICY guildos_adventurers_all_self ON guildos.adventurers FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_adventurer_assignments_self ON guildos.adventurer_assignments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.adventurers a WHERE a.id = adventurer_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM guildos.adventurers a WHERE a.id = adventurer_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

CREATE POLICY guildos_potions_all_self ON guildos.potions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_credential_tokens_self ON guildos.credential_tokens FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.potions p WHERE p.id = potion_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM guildos.potions p WHERE p.id = potion_id AND p.user_id = auth.uid())
  );

CREATE POLICY guildos_notification_channels_self ON guildos.notification_channels FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_messages_self ON guildos.messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_delivery_attempts_self ON guildos.delivery_attempts FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.messages m WHERE m.id = message_id AND m.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM guildos.messages m WHERE m.id = message_id AND m.user_id = auth.uid())
  );

CREATE POLICY guildos_escalations_self ON guildos.escalations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY guildos_approval_requests_self ON guildos.approval_requests FOR ALL TO authenticated
  USING (
    escalation_id IS NULL
    OR EXISTS (SELECT 1 FROM guildos.escalations e WHERE e.id = escalation_id AND e.user_id = auth.uid())
  ) WITH CHECK (
    escalation_id IS NULL
    OR EXISTS (SELECT 1 FROM guildos.escalations e WHERE e.id = escalation_id AND e.user_id = auth.uid())
  );

CREATE POLICY guildos_scribe_logs_self ON guildos.scribe_logs FOR ALL TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY guildos_run_artifacts_self ON guildos.run_artifacts FOR ALL TO authenticated
  USING (
    quest_id IS NULL
    OR EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  ) WITH CHECK (
    quest_id IS NULL
    OR EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

CREATE POLICY guildos_quest_reports_self ON guildos.quest_reports FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

-- Catalog reads for authenticated users
CREATE POLICY guildos_characters_read ON guildos.characters FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_character_assets_read ON guildos.character_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_locations_read ON guildos.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_location_routes_read ON guildos.location_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_hats_read ON guildos.hats FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_hat_capabilities_read ON guildos.hat_capabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_weapons_read ON guildos.weapons FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_tool_integrations_read ON guildos.tool_integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_tool_permissions_read ON guildos.tool_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_shields_read ON guildos.shields FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_safeguard_rules_read ON guildos.safeguard_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY guildos_dev_tasks_read ON guildos.dev_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY guildos_quest_board_read ON guildos.quest_board_entries FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

CREATE POLICY guildos_quest_status_history_read ON guildos.quest_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM guildos.quests q WHERE q.id = quest_id AND q.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Ensure profile row exists (trigger on auth.users)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guildos.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = guildos, public
AS $$
BEGIN
  INSERT INTO guildos.users (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_guildos ON auth.users;
CREATE TRIGGER on_auth_user_created_guildos
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION guildos.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed: locations, characters, dev tasks, sample modules (idempotent keys)
-- ---------------------------------------------------------------------------
INSERT INTO guildos.locations (slug, name, description, route_path, map_x, map_y, icon_key, sort_order)
VALUES
  ('town-map', 'Town Map', 'Central navigation', '/town', 50, 50, 'map', 0),
  ('inn', 'The Inn', 'Quest intake, planning, logs, and consul', '/town/inn', 22, 38, 'inn', 1),
  ('town-square', 'Town Square', 'Smith, Armory, Apothecary, Shields', '/town/town-square', 55, 42, 'square', 2),
  ('world-map', 'World Map', 'Future territories', '/town/world-map', 78, 28, 'globe', 3),
  ('smith', 'The Smith', 'Tools, APIs, MCP integrations', '/town/town-square#smith', 40, 60, 'hammer', 10),
  ('armory', 'The Armory', 'Roles / capability bundles (hats)', '/town/town-square#armory', 55, 58, 'helmet', 11),
  ('apothecary', 'The Apothecary', 'Temporary credentials / tokens', '/town/town-square#apothecary', 70, 60, 'potion', 12),
  ('shields', 'Shield Hall', 'Policies, permissions, safeguards', '/town/town-square#shields', 82, 55, 'shield', 13)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO guildos.characters (slug, name, title, role_hint, sort_order)
VALUES
  ('ember', 'Ember', 'Guild Guide', 'Welcomes travelers; future: onboarding agent', 1),
  ('sage', 'Sage', 'Archivist', 'Remembers lore; future: memory / RAG', 2),
  ('bolt', 'Bolt', 'Runner', 'Quick feet; future: fast worker pool', 3),
  ('mirth', 'Mirth', 'Troubadour', 'Keeps morale; future: notifications tone', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO guildos.character_assets (character_id, asset_kind, public_url, alt_text)
SELECT c.id, 'portrait', '/images/guildos/chibis/' || c.slug || '.svg', c.name || ' chibi'
FROM guildos.characters c
WHERE NOT EXISTS (SELECT 1 FROM guildos.character_assets a WHERE a.character_id = c.id);

INSERT INTO guildos.dev_tasks (title, description, status, sort_order, module_key)
SELECT title, description, status::guildos.dev_task_status, sort_order, module_key
FROM (
  VALUES
    ('Hook up real auth flow', 'Wire hosted auth session + guildos.users provisioning; optional app_sessions writes.', 'todo', 10, 'auth'),
    ('Finalize module-object mapping', 'Confirm metaphor → service boundaries with product.', 'todo', 20, 'architecture'),
    ('Build request intake form', 'POST guildos.requests → quest draft.', 'todo', 30, 'quest_intake'),
    ('Build quest planning UI', 'War Room editor for quest_plans / quest_steps / success_criteria.', 'todo', 40, 'planning'),
    ('Add quest board interactions', 'Claim / assign quests via quest_board_entries.', 'todo', 50, 'quest_board'),
    ('Add adventurer assignment system', 'Link adventurers to quests and hats.', 'todo', 60, 'adventurers'),
    ('Implement hats / role management', 'CRUD hats + hat_capabilities.', 'todo', 70, 'hats'),
    ('Implement weapons / tool integrations', 'Smith: weapons, tool_integrations, tool_permissions.', 'todo', 80, 'smith'),
    ('Implement potion token lifecycle', 'Apothecary: potions + credential_tokens with vault storage.', 'todo', 90, 'apothecary'),
    ('Implement shield safeguard policies', 'Evaluate safeguard_rules at execution gates.', 'todo', 100, 'shields'),
    ('Implement scribe logging viewer', 'Search scribe_logs + run_artifacts + quest_reports.', 'todo', 110, 'scribe'),
    ('Implement messenger channel config', 'notification_channels + messages + delivery_attempts.', 'todo', 120, 'messenger'),
    ('Implement consul escalation flow', 'escalations + approval_requests UI.', 'todo', 130, 'consul'),
    ('Expand world map', 'New locations + location_routes graph.', 'todo', 140, 'town'),
    ('Add persistent task editing', 'Admin UI for dev_tasks or move to repo-backed markdown.', 'todo', 150, 'dev_tasks')
) AS v(title, description, status, sort_order, module_key)
WHERE NOT EXISTS (SELECT 1 FROM guildos.dev_tasks d WHERE d.title = v.title);

-- Sample hats / weapons for Town Square cards (reference data)
INSERT INTO guildos.hats (slug, name, description)
VALUES
  ('scout', 'Scout Hat', 'Discovery and research specialization'),
  ('clerk', 'Clerk Hat', 'Documentation and structured output')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO guildos.weapons (slug, name, description, tool_type)
VALUES
  ('web-search', 'Seeker Blade', 'Web search tool integration', 'search'),
  ('http-api', 'Rune API', 'Generic HTTP / REST caller', 'http')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO guildos.shields (slug, name, description)
VALUES
  ('rate-limit', 'Warding Circle', 'Rate limits and burst control'),
  ('pii-mask', 'Veil Shield', 'PII redaction before external calls')
ON CONFLICT (slug) DO NOTHING;

-- Backfill app users for accounts that already existed before this migration.
INSERT INTO guildos.users (id, display_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;
