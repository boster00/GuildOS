-- Add avatar_url column to adventurers
ALTER TABLE public.adventurers
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.adventurers.avatar_url IS 'URL or path to chibi avatar image';
