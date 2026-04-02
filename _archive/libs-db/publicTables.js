/**
 * PostgREST `public` table names (plural).
 * Keep aligned with supabase/migrations/20260328160000_rename_core_tables_plural.sql
 * and libs that query these tables.
 */
export const publicTables = {
  quests: "quests",
  parties: "parties",
  items: "items",
  adventurers: "adventurers",
  potions: "potions",
  profiles: "profiles",
};
