# Image Storage Setup

This document describes how to set up image storage for the Content Magic image insert feature.

## Database Setup

Run the migrations to create the images table and storage policies:

1. **Enhance images table** (if not already done):
```sql
-- Run the migration file
supabase/migrations/create_user_images_table.sql
```
Note: This migration enhances the existing `images` table with storage tracking fields.

2. **Create storage bucket RLS policies** (REQUIRED):
```sql
-- Run the migration file
supabase/migrations/create_storage_bucket_policies.sql
```

## Storage Bucket Setup

You need to create a Supabase Storage bucket named `images`:

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Click "New bucket"
4. Name it `images`
5. Make it **public** (or configure RLS policies as needed)

### Storage Bucket RLS Policies

**IMPORTANT**: You must set up RLS policies for the storage bucket, even if it's public. Run the migration:

```sql
-- Run the migration file
supabase/migrations/create_storage_bucket_policies.sql
```

Or manually create the policies in Supabase SQL Editor. The policies ensure users can only access their own files (organized by user_id folder).

## Features

The image insert UI provides:

- **Image Attributes**: Edit src, id, title, alt, class, width, height
- **Browse Images**: View recent images from database with pagination
- **Search**: Search images by title, alt, or src
- **Upload**: Upload new images via file selector
- **AI Generation**: Generate images using DALL-E 3
- **Database Storage**: All images (uploaded and generated) are saved to the database

## Usage

1. Click the image icon in the editor toolbar to insert a new image
2. Click on an existing image in the editor to edit it
3. Use the "Browse" button to select from existing images
4. Use the "Generate with AI" button to create new images
5. Use the "Upload New Image" button to upload files
