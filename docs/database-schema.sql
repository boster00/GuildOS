


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pigeon_letters_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."pigeon_letters_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_guild_adventurers"("p_owner_id" "uuid") RETURNS TABLE("adventurer_name" "text", "adventurer_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Cat — the Questmaster (triages quests, assigns adventurers)
  INSERT INTO adventurers (id, owner_id, name, system_prompt, skill_books, capabilities, backstory)
  VALUES (
    'a1000000-0000-0000-0000-000000000001',
    p_owner_id,
    'Cat',
    'You are Cat, the Questmaster of the guild. You triage quests at the idea stage.

Examine the quest title and description alongside the provided roster of adventurers and their capabilities.

If an adventurer on the roster is a good match for the quest, respond with ONLY this JSON:
{"action":"assign","adventurer_id":"<exact uuid from roster>","msg":"<brief rationale>"}

If NO adventurer is a good match, respond with ONLY this JSON:
{"action":"recruit","child_title":"Recruit adventurer for: <original quest title>","next_steps":["<original quest description>"],"msg":"<brief rationale why no one fits>"}

Rules:
- Respond with ONLY one JSON object. No prose, no markdown, no explanation outside the JSON.
- "msg" must be a non-empty string.
- For "assign": adventurer_id must be an exact UUID from the provided roster.
- For "recruit": child_title must start with "Recruit adventurer for: ".',
    ARRAY['questmaster'],
    'Triages incoming quests. Matches quests to adventurers by capability. Spawns recruiting quests when no match exists.',
    'The Cat is the Questmaster of the guild — sharp-eyed, decisive, and always scanning the roster for the right fit.'
  )
  ON CONFLICT (id) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    skill_books = EXCLUDED.skill_books,
    capabilities = EXCLUDED.capabilities,
    updated_at = now();

  -- Pig — the Guildmaster (plans quests, manages recruitment and skill book creation)
  INSERT INTO adventurers (id, owner_id, name, system_prompt, skill_books, capabilities, backstory)
  VALUES (
    'a2000000-0000-0000-0000-000000000002',
    p_owner_id,
    'Pig',
    'You are Pig, the Guildmaster. You plan quests at the plan stage — specifically recruiting quests and capability-gap quests.

You will be given a quest title and description, plus a list of available skill books.

If an existing skill book covers what is needed to fulfill the quest, build an execution_plan using it and respond with ONLY this JSON:
{"action":"plan","execution_plan":[{"skillbook":"<id>","action":"<actionName>"}],"msg":"<rationale>"}

If NO skill book covers the domain, respond with ONLY this JSON:
{"action":"create_skillbook","child_title":"Design skill book for: <domain>","weapon_spec":{"name":"<WeaponName>","description":"<one sentence>","codeGoal":"<what the weapon code should do>","actions":["<actionName>"]},"setup_steps":["Step 1: <credential or setup instruction>","Step 2: <next step>"],"next_steps":["<current quest description>"],"msg":"<rationale>"}

Rules:
- Respond with ONLY one JSON object. No prose, no markdown.
- weapon_spec.name should be PascalCase (e.g. BigQuery, Calculator).
- setup_steps are instructions for the human user to set up credentials or environment.',
    ARRAY['guildmaster'],
    'Plans quests. Checks skill book availability. Spawns skill book creation quests when capability gaps exist.',
    'Pig is the Guildmaster — methodical, well-connected, and knows every skill book in the library by heart.'
  )
  ON CONFLICT (id) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    skill_books = EXCLUDED.skill_books,
    capabilities = EXCLUDED.capabilities,
    updated_at = now();

  -- Runesmith — designs skill books and delegates weapon forging to Blacksmith
  INSERT INTO adventurers (id, owner_id, name, system_prompt, skill_books, capabilities, backstory)
  VALUES (
    'a3000000-0000-0000-0000-000000000003',
    p_owner_id,
    'Runesmith',
    'You are the Runesmith. You design skill books and delegate weapon forging to the Blacksmith.

At the plan stage you will receive a quest asking you to design a skill book for a given domain.
You will also receive a weapon_spec (from quest inventory) describing what weapon needs to be forged.

Respond with ONLY this JSON:
{"action":"plan","execution_plan":[{"skillbook":"blacksmith","action":"forgeWeapon"},{"skillbook":"blacksmith","action":"updateProvingGrounds"}],"weapon_spec":{"name":"<WeaponName>","description":"<one sentence>","codeGoal":"<precise description of what the weapon code should do, including file path>","actions":["<action1>","<action2>"]},"setup_steps":["Step 1: <human setup instruction>","Step 2: <next step>"],"msg":"<rationale>"}

Rules:
- Respond with ONLY one JSON object. No prose, no markdown.
- execution_plan is always exactly the two blacksmith steps shown above.
- weapon_spec.codeGoal should be precise enough for Claude CLI to write the code without ambiguity.
- setup_steps are human-readable instructions for setting up credentials or config.',
    ARRAY['guildmaster', 'blacksmith'],
    'Designs skill book structures. Assesses weapon needs. Delegates code generation to Blacksmith.',
    'The Runesmith inscribes the blueprints — turning vague capability gaps into precise weapon specifications.'
  )
  ON CONFLICT (id) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    skill_books = EXCLUDED.skill_books,
    capabilities = EXCLUDED.capabilities,
    updated_at = now();

  -- Blacksmith — forges weapons via claudeCLI
  INSERT INTO adventurers (id, owner_id, name, system_prompt, skill_books, capabilities, backstory)
  VALUES (
    'a4000000-0000-0000-0000-000000000004',
    p_owner_id,
    'Blacksmith',
    'You are the Blacksmith. You forge weapons by running the claudeCLI tool.

At the plan stage you will receive a quest with a weapon_spec in the inventory.
Your execution_plan is ALWAYS exactly these two steps — no more, no less:
1. blacksmith.forgeWeapon — invokes Claude CLI to write the weapon code
2. blacksmith.updateProvingGrounds — saves setup steps to the proving grounds UI

Respond with ONLY this JSON:
{"action":"plan","execution_plan":[{"skillbook":"blacksmith","action":"forgeWeapon"},{"skillbook":"blacksmith","action":"updateProvingGrounds"}],"msg":"Ready to forge."}

Rules:
- Respond with ONLY one JSON object. No prose, no markdown.
- execution_plan is always exactly the two steps above.',
    ARRAY['blacksmith'],
    'Forges weapons by invoking Claude CLI to write weapon code files and register them.',
    'The Blacksmith strikes true — given a spec, the weapon is forged and the proving grounds updated.'
  )
  ON CONFLICT (id) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    skill_books = EXCLUDED.skill_books,
    capabilities = EXCLUDED.capabilities,
    updated_at = now();

  RETURN QUERY
  SELECT name, id FROM adventurers
  WHERE id IN (
    'a1000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-000000000003',
    'a4000000-0000-0000-0000-000000000004'
  )
  AND owner_id = p_owner_id;
END;
$$;


ALTER FUNCTION "public"."seed_guild_adventurers"("p_owner_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adventurers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "backstory" "text",
    "owner_id" "uuid",
    "system_prompt" "text",
    "skill_books" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "capabilities" "text"
);


ALTER TABLE "public"."adventurers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."adventurers"."skill_books" IS 'Skill book catalog keys (folder names under libs/skill_book), not skill_books table row IDs.';



CREATE TABLE IF NOT EXISTS "public"."pigeon_letters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quest_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "target_item_key" "text",
    "result" "jsonb",
    "error_message" "text",
    "claimed_at" timestamp with time zone,
    "claimed_by" "text",
    "lease_expires_at" timestamp with time zone,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_run_at" timestamp with time zone,
    "correlation_id" "text",
    "idempotency_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pigeon_letters_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "pigeon_letters_channel_check" CHECK (("char_length"("btrim"("channel")) > 0)),
    CONSTRAINT "pigeon_letters_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'claimed'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pigeon_letters" OWNER TO "postgres";


COMMENT ON TABLE "public"."pigeon_letters" IS 'Async pigeon post: per-quest messages for external systems and workers; not quest inventory JSON.';



COMMENT ON COLUMN "public"."pigeon_letters"."channel" IS 'Which integration or transport owns this row; set explicitly on insert (no default).';



COMMENT ON COLUMN "public"."pigeon_letters"."payload" IS 'Opaque instructions for the channel (shape defined by that channel, not the table).';



COMMENT ON COLUMN "public"."pigeon_letters"."target_item_key" IS 'When delivery maps into quest inventory, the item_key to write; otherwise null.';



COMMENT ON COLUMN "public"."pigeon_letters"."result" IS 'Outcome: delivered value, HTTP summary, worker output, etc.';



COMMENT ON COLUMN "public"."pigeon_letters"."claimed_by" IS 'Opaque worker or external system id (consumer name, job id, etc.).';



COMMENT ON COLUMN "public"."pigeon_letters"."lease_expires_at" IS 'Stale workers may reclaim or reset rows when lease_expires_at < now().';



COMMENT ON COLUMN "public"."pigeon_letters"."next_run_at" IS 'Optional schedule for pollers / delayed retry.';



COMMENT ON COLUMN "public"."pigeon_letters"."idempotency_key" IS 'Per-quest dedupe for external retries; unique when set (partial index).';



COMMENT ON COLUMN "public"."pigeon_letters"."metadata" IS 'Extensible channel tags (priority, source action, dead-letter flags, etc.).';



CREATE TABLE IF NOT EXISTS "public"."potions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "secrets" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."potions" OWNER TO "postgres";


COMMENT ON TABLE "public"."potions" IS 'Per-user auth tokens and temporary secrets; shape depends on kind (e.g. zoho_books).';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "subscription_tier_id" "text",
    "subscription_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "override_quota" boolean DEFAULT false NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "credits_reset_at" timestamp with time zone,
    "credits_remaining" numeric DEFAULT 0 NOT NULL,
    "payg_wallet" numeric DEFAULT 0 NOT NULL,
    "coins_work_order" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subscription_renewal_at" timestamp with time zone,
    "subscription_period_start_at" timestamp with time zone,
    "subscription_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "env_vars" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "council_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."env_vars" IS 'Non-public app credentials and integration config per user/tenant (e.g. Zoho Books OAuth client id/secret). Merge via API; never return secrets to client in plaintext except on write.';



COMMENT ON COLUMN "public"."profiles"."council_settings" IS 'Council JSON: dungeon_master { api_key, base_url, model_id }, etc. Merge via API; never return api_key to client in plaintext.';



CREATE TABLE IF NOT EXISTS "public"."quest_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quest_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "action" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quest_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."quest_comments" IS 'Timestamped log lines for quest automation (cat pipeline, scribe, inventory actions).';



CREATE TABLE IF NOT EXISTS "public"."quests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "success_criteria" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_to" "text",
    "parent_quest_id" "uuid",
    "stage" "text" DEFAULT 'idea'::"text" NOT NULL,
    "deliverables" "text",
    "due_date" timestamp with time zone,
    "assignee_id" "uuid",
    "execution_plan" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "inventory" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "next_steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "quest_stage_check" CHECK (("stage" = ANY (ARRAY['idea'::"text", 'plan'::"text", 'assign'::"text", 'execute'::"text", 'review'::"text", 'closing'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."quests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quests"."execution_plan" IS 'Tactical steps: jsonb array of {skillbook, action, input: string[], output: string[]}';



COMMENT ON COLUMN "public"."quests"."inventory" IS 'Jsonb array of { item_key, payload?, created_at? }; quest step inputs/outputs.';



COMMENT ON COLUMN "public"."quests"."next_steps" IS 'Ordered follow-on steps; advanceClosing pops the head and creates a child quest carrying the tail.';



ALTER TABLE ONLY "public"."adventurers"
    ADD CONSTRAINT "adventurer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pigeon_letters"
    ADD CONSTRAINT "pigeon_letters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."potions"
    ADD CONSTRAINT "potions_owner_id_kind_key" UNIQUE ("owner_id", "kind");



ALTER TABLE ONLY "public"."potions"
    ADD CONSTRAINT "potions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quest_comments"
    ADD CONSTRAINT "quest_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quest_pkey" PRIMARY KEY ("id");



CREATE INDEX "adventurers_owner_id_idx" ON "public"."adventurers" USING "btree" ("owner_id");



CREATE INDEX "pigeon_letters_channel_status_idx" ON "public"."pigeon_letters" USING "btree" ("channel", "status");



CREATE INDEX "pigeon_letters_next_run_idx" ON "public"."pigeon_letters" USING "btree" ("next_run_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "pigeon_letters_owner_status_idx" ON "public"."pigeon_letters" USING "btree" ("owner_id", "status");



CREATE INDEX "pigeon_letters_quest_id_idx" ON "public"."pigeon_letters" USING "btree" ("quest_id");



CREATE UNIQUE INDEX "pigeon_letters_quest_idempotency_uidx" ON "public"."pigeon_letters" USING "btree" ("quest_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "potions_owner_kind_idx" ON "public"."potions" USING "btree" ("owner_id", "kind");



CREATE INDEX "quest_comments_quest_id_created_at_idx" ON "public"."quest_comments" USING "btree" ("quest_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "pigeon_letters_set_updated_at" BEFORE UPDATE ON "public"."pigeon_letters" FOR EACH ROW EXECUTE FUNCTION "public"."pigeon_letters_set_updated_at"();



ALTER TABLE ONLY "public"."adventurers"
    ADD CONSTRAINT "adventurers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pigeon_letters"
    ADD CONSTRAINT "pigeon_letters_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pigeon_letters"
    ADD CONSTRAINT "pigeon_letters_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."potions"
    ADD CONSTRAINT "potions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_comments"
    ADD CONSTRAINT "quest_comments_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quest_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quest_parent_quest_id_fkey" FOREIGN KEY ("parent_quest_id") REFERENCES "public"."quests"("id");



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."adventurers"("id") ON DELETE SET NULL;



CREATE POLICY "adventurer_owner_all" ON "public"."adventurers" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



ALTER TABLE "public"."adventurers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pigeon_letters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pigeon_letters_delete_own" ON "public"."pigeon_letters" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "pigeon_letters_insert_own" ON "public"."pigeon_letters" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "pigeon_letters_select_own" ON "public"."pigeon_letters" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "pigeon_letters_update_own" ON "public"."pigeon_letters" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."potions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "potions_owner_delete" ON "public"."potions" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "potions_owner_insert" ON "public"."potions" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "potions_owner_select" ON "public"."potions" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "potions_owner_update" ON "public"."potions" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."quest_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quest_comments_owner_delete" ON "public"."quest_comments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quests" "q"
  WHERE (("q"."id" = "quest_comments"."quest_id") AND ("q"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "quest_comments_owner_insert" ON "public"."quest_comments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quests" "q"
  WHERE (("q"."id" = "quest_comments"."quest_id") AND ("q"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "quest_comments_owner_select" ON "public"."quest_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quests" "q"
  WHERE (("q"."id" = "quest_comments"."quest_id") AND ("q"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "quest_owner_all" ON "public"."quests" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."quests" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pigeon_letters_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."pigeon_letters_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pigeon_letters_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_guild_adventurers"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_guild_adventurers"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_guild_adventurers"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."adventurers" TO "anon";
GRANT ALL ON TABLE "public"."adventurers" TO "authenticated";
GRANT ALL ON TABLE "public"."adventurers" TO "service_role";



GRANT ALL ON TABLE "public"."pigeon_letters" TO "anon";
GRANT ALL ON TABLE "public"."pigeon_letters" TO "authenticated";
GRANT ALL ON TABLE "public"."pigeon_letters" TO "service_role";



GRANT ALL ON TABLE "public"."potions" TO "anon";
GRANT ALL ON TABLE "public"."potions" TO "authenticated";
GRANT ALL ON TABLE "public"."potions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quest_comments" TO "anon";
GRANT ALL ON TABLE "public"."quest_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."quest_comments" TO "service_role";



GRANT ALL ON TABLE "public"."quests" TO "anon";
GRANT ALL ON TABLE "public"."quests" TO "authenticated";
GRANT ALL ON TABLE "public"."quests" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







