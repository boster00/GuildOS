-- Drop the legacy `quests.inventory` JSONB column. Items now live in the `items` table.
-- Data was migrated via scripts/migrate-inventory-to-items.mjs prior to this migration.

ALTER TABLE public.quests DROP COLUMN IF EXISTS inventory;
