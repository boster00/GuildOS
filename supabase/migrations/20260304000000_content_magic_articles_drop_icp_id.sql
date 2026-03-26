-- Migrate article ICP association from icp_id column to context.icpId.
-- Run after code no longer writes to icp_id; backfill ensures no data loss.

-- Step 1: Backfill context.icpId from icp_id for rows where it is missing
UPDATE content_magic_articles
SET context = jsonb_set(
  COALESCE(context, '{}'::jsonb),
  '{icpId}',
  to_jsonb(icp_id::text)
)
WHERE icp_id IS NOT NULL
  AND (context->>'icpId' IS NULL OR context->>'icpId' = '');

-- Step 2: Drop the FK constraint
ALTER TABLE content_magic_articles
  DROP CONSTRAINT IF EXISTS content_magic_articles_icp_id_fkey;

-- Step 3: Drop the column
ALTER TABLE content_magic_articles
  DROP COLUMN IF EXISTS icp_id;
