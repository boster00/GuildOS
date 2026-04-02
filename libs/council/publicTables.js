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
  /** Party rows (legacy). */
  parties: "parties",
  /** Legacy `items` table (party line-items). Not the same as `quests.inventory` jsonb. */
  items: "items",
  adventurers: "adventurers",
  potions: "potions",
  profiles: "profiles",
};
