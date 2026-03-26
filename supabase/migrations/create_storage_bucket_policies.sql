-- Migration: Create Storage Bucket RLS Policies for images bucket
-- Run this in your Supabase SQL Editor
--
-- Prerequisites:
-- 1. Create a storage bucket named 'images' in Supabase Dashboard
-- 2. The bucket can be public or private (these policies work for both)
--
-- This migration creates RLS policies that allow users to:
-- - Upload files to their own folder (user_id/filename)
-- - View their own files
-- - Delete their own files
-- - Update their own files

-- Allow users to upload files to their own folder
-- File path structure: {user_id}/{filename}
-- Note: (storage.foldername(name))[1] gets the first folder from the path
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view/read their own files
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files (optional, for metadata updates)
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
