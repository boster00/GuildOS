-- Update campaign_phase check constraint to allow value 4 (Expand phase)
-- Drop the existing constraint
ALTER TABLE content_magic_articles 
DROP CONSTRAINT IF EXISTS content_magic_articles_campaign_phase_check;

-- Add the updated constraint that allows 1, 2, 3, and 4
ALTER TABLE content_magic_articles 
ADD CONSTRAINT content_magic_articles_campaign_phase_check 
CHECK (campaign_phase IS NULL OR campaign_phase IN (1, 2, 3, 4));

