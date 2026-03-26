-- Backfill storage_path from src for legacy images that have Supabase storage URLs
-- Only updates rows where storage_path IS NULL and src matches the Supabase public URL pattern

UPDATE public.images
SET storage_path = (regexp_match(src, 'object/public/images/([^?#]+)'))[1]
WHERE storage_path IS NULL
  AND src IS NOT NULL
  AND src ~ 'https?://[^/]+\.supabase\.co/storage/v1/object/public/images/[^?#]+';
