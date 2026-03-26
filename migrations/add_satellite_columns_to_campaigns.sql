-- Migration: Add satellites JSONB column to campaigns table
-- Run this in your Supabase SQL Editor

-- Add satellites column (JSONB object containing all satellite data)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS satellites JSONB DEFAULT '{"evaluations": [], "plannedSatellites": [], "schedule": {"cadence": "weekly", "startDate": null}}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.satellites IS 'Satellite planning data: evaluations, plannedSatellites, and schedule';

-- Optional: Add GIN index for better JSONB query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_satellites ON campaigns USING GIN (satellites);

