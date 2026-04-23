/**
 * PostgREST `public` table names (plural).
 * Keep aligned with supabase/migrations/20260328160000_rename_core_tables_plural.sql
 * and libs that query these tables.
 */
export const publicTables = {
  quests: "quests",
  /** Async per-quest messages (external channels / workers). */
  pigeonLetters: "pigeon_letters",
  questComments: "quest_comments",
  /** Per-quest deliverables (screenshots/artifacts). Replaces `quests.inventory` JSONB. UNIQUE(quest_id, item_key) enforces REPLACE-don't-pile-on. */
  items: "items",
  /** Review comments on specific items. */
  itemComments: "item_comments",
  adventurers: "adventurers",
  potions: "potions",
  profiles: "profiles",
};
