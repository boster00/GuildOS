-- Add user preference for credits metering (toggle in UI).
-- When false, quota check allows, log and deduct no-op (single gate in metering.js).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metering_enabled boolean NOT NULL DEFAULT true;
