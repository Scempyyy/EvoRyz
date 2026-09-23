-- ==============================================================================
-- Migration: 20260923120000_workspace_media_storage.sql
-- Description: Configure private workspace-media storage bucket with strict RLS
-- ==============================================================================

-- 1. Create or ensure private 'workspace-media' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('workspace-media', 'workspace-media', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- 2. Storage RLS Policies for authenticated users
-- Files are stored under: {workspace_id}/{message_id}.{ext} or {user_id}/{file_name}

DROP POLICY IF EXISTS "Workspace media viewable by workspace members" ON storage.objects;
CREATE POLICY "Workspace media viewable by workspace members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workspace-media'
  AND (
    (
      public.is_workspace_member(
        CASE 
          WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN ((storage.foldername(name))[1])::uuid
          ELSE NULL
        END
      )
    )
    OR
    (
      (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Workspace media insertable by workspace members" ON storage.objects;
CREATE POLICY "Workspace media insertable by workspace members"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workspace-media'
  AND (
    (
      public.is_workspace_member(
        CASE 
          WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN ((storage.foldername(name))[1])::uuid
          ELSE NULL
        END
      )
    )
    OR
    (
      (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Workspace media deletable by owner or workspace member" ON storage.objects;
CREATE POLICY "Workspace media deletable by owner or workspace member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workspace-media'
  AND (
    owner = auth.uid()
    OR
    owner_id = auth.uid()::text
    OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);
