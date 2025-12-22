-- ============================================
-- SUPABASE STORAGE SETUP FOR ATLASP2P
-- ============================================
-- Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste & Run

-- Step 1: Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'node-avatars',
  'node-avatars',
  true,  -- Public bucket (avatars are public)
  2097152,  -- 2MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policy - Public Read Access
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
USING (bucket_id = 'node-avatars');

-- Step 4: Create RLS Policy - Authenticated Upload
DROP POLICY IF EXISTS "Authenticated uploads" ON storage.objects;
CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'node-avatars'
  AND auth.role() = 'authenticated'
);

-- Step 5: Create RLS Policy - Owner Delete
DROP POLICY IF EXISTS "Owner can delete" ON storage.objects;
CREATE POLICY "Owner can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'node-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification query
SELECT
  'Bucket created' as status,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'node-avatars';

-- Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
