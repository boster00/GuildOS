-- Merge `quests.deliverables` JSONB column into the `items` table.
-- Each items row now carries both the EXPECTATION (set at quest creation) and the
-- ARTIFACT (filled when the worker uploads). url IS NULL = pending. The gate
-- checks one query: SELECT COUNT(*) FROM items WHERE quest_id=$1 AND url IS NULL.
--
-- After this migration:
--   - items.expectation is the per-row spec (what should be there)
--   - items.caption is the per-row worker note (what was actually shipped)
--   - quests.deliverables column is DEPRECATED but not dropped (kept for read
--     compatibility during transition; libs/quest stops writing to it)
--   - items.source column is DEPRECATED (provenance moves to item_comments
--     when needed)
--
-- A companion data-migration script (scripts/migrate-items-merge.mjs) backfills
-- expectation from existing deliverables JSON entries and promotes orphan
-- entries (deliverables[i] with no matching items row) to items rows.

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

-- 1. Add `expectation` — per-item declared spec, set at quest creation.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS expectation text;

COMMENT ON COLUMN public.items.expectation IS
  'What this item should be — the declared spec, set at quest creation. Used as the verifier prompt for imageJudge / Cat. Immutable-by-convention; mid-quest changes should be audited via item_comments.';

-- 2. Rename `description` → `caption` to disambiguate from `expectation`.
--    `caption` = worker''s one-liner about what was actually shipped (filled at upload time).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'description'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'caption'
  ) THEN
    ALTER TABLE public.items RENAME COLUMN description TO caption;
  END IF;
END $$;

COMMENT ON COLUMN public.items.caption IS
  'Worker''s one-line note about the artifact that was shipped (filled at delivery time, not quest creation). Distinct from expectation (the declared spec).';

-- 3. `source` column stays for now (data still references it). Future cleanup
--    will drop after libs/quest writeItem stops writing to it.
COMMENT ON COLUMN public.items.source IS
  'DEPRECATED: provenance is now derived from quests.assigned_to + item_comments role. Column kept for legacy reads; do not write new values.';

-- 4. quests.deliverables column stays for now (data still there). Future cleanup
--    will drop after data migration completes and code stops reading from it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quests' AND column_name = 'deliverables'
  ) THEN
    EXECUTE $cmt$
      COMMENT ON COLUMN public.quests.deliverables IS
        'DEPRECATED: spec moved to items.expectation per row. Column kept transitionally for read-back of legacy quests.';
    $cmt$;
  END IF;
END $$;

-- 5. Extend item_comments.role to include 'user' (user-attached notes from GM desk).
--    'adventurer' was the worker role; keeping that name for continuity with existing data.
ALTER TABLE public.item_comments
  DROP CONSTRAINT IF EXISTS item_comments_role_check;

ALTER TABLE public.item_comments
  ADD CONSTRAINT item_comments_role_check
  CHECK (role IN ('adventurer', 'questmaster', 'chaperon', 'guildmaster', 'user'));

-- ---------------------------------------------------------------------------
-- Index for the gate query
-- ---------------------------------------------------------------------------

-- The gate reads items WHERE quest_id = $1 AND url IS NULL. Add a partial index
-- so this is fast even as items grows.
CREATE INDEX IF NOT EXISTS items_pending_idx
  ON public.items (quest_id)
  WHERE url IS NULL;
