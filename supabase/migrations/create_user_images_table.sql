-- Migration: Enhance images table and create user_storage_usage table
-- Run this in your Supabase SQL Editor
--
-- This migration enhances the existing images table with storage tracking fields
-- and creates the user_storage_usage table for quota management

-- Enhance existing images table with storage tracking fields (if not already present)
DO $$ 
BEGIN
  -- Add storage_path if it doesn't exist (for Supabase Storage paths)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.images ADD COLUMN storage_path text;
  END IF;

  -- Add file_size if it doesn't exist (for storage quota tracking)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'file_size'
  ) THEN
    ALTER TABLE public.images ADD COLUMN file_size bigint;
  END IF;

  -- Add mime_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE public.images ADD COLUMN mime_type text;
  END IF;

  -- Add file_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.images ADD COLUMN file_name text;
  END IF;

  -- Add metadata if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.images ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Make src nullable (since we can have storage_path instead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND column_name = 'src'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.images ALTER COLUMN src DROP NOT NULL;
  END IF;

  -- Add constraint to ensure either storage_path or src is provided (if constraint doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
    AND table_name = 'images' 
    AND constraint_name = 'images_storage_or_src'
  ) THEN
    ALTER TABLE public.images ADD CONSTRAINT images_storage_or_src CHECK (
      (storage_path IS NOT NULL) OR (src IS NOT NULL)
    );
  END IF;
END $$;

-- Create user_storage_usage table for quota tracking
CREATE TABLE IF NOT EXISTS public.user_storage_usage (
  user_id uuid NOT NULL,
  total_bytes_used bigint NOT NULL DEFAULT 0,
  image_count integer NOT NULL DEFAULT 0,
  ai_images_generated_this_month integer NOT NULL DEFAULT 0,
  ai_images_quota_reset_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_storage_usage_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_storage_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance on images table
CREATE INDEX IF NOT EXISTS idx_images_storage_path ON public.images(storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_file_name ON public.images(file_name) WHERE file_name IS NOT NULL;

-- Enable RLS on user_storage_usage (images table should already have RLS enabled)
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_storage_usage
DROP POLICY IF EXISTS "Users can view their own storage usage" ON public.user_storage_usage;
DROP POLICY IF EXISTS "Users can update their own storage usage" ON public.user_storage_usage;

CREATE POLICY "Users can view their own storage usage"
  ON public.user_storage_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage usage"
  ON public.user_storage_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- Note: The images table should already have RLS policies from create_images_table.sql
