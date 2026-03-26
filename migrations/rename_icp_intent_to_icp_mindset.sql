-- Migration: Rename icpIntent to icpMindset in content_magic_articles.context JSONB field
-- Date: 2024
-- Description: Updates all existing records in content_magic_articles table to rename 
--              the 'icpIntent' key to 'icpMindset' in the context JSONB column

-- Update all records where context contains icpIntent key
UPDATE content_magic_articles
SET context = jsonb_set(
  context - 'icpIntent',  -- Remove old key
  '{icpMindset}',         -- Add new key
  context->'icpIntent'    -- Copy value from old key
)
WHERE context ? 'icpIntent'  -- Only update rows where icpIntent exists
  AND context->>'icpIntent' IS NOT NULL;  -- And value is not null

-- Verify the update (optional - run this to check results)
-- SELECT 
--   id,
--   title,
--   context->'icpMindset' as icp_mindset,
--   context->'icpIntent' as old_icp_intent
-- FROM content_magic_articles
-- WHERE context ? 'icpMindset' OR context ? 'icpIntent'
-- LIMIT 10;

