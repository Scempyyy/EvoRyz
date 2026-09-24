-- ==============================================================================
-- Migration: 20260924000000_profile_and_workspace_pfp_system_messages.sql
-- Description: Add avatar_url to workspaces, support system messages, and setup avatars storage
-- ==============================================================================

-- 1. Add avatar_url to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Update messages_message_type_check constraint to include 'system'
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'video', 'file', 'voice', 'system'));

-- 3. Create or ensure private 'avatars' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

-- 4. Storage policies for avatars
DROP POLICY IF EXISTS "Avatars viewable by authenticated users" ON storage.objects;
CREATE POLICY "Avatars viewable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars insertable by authenticated users" ON storage.objects;
CREATE POLICY "Avatars insertable by authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars updatable by authenticated users" ON storage.objects;
CREATE POLICY "Avatars updatable by authenticated users"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars deletable by authenticated users" ON storage.objects;
CREATE POLICY "Avatars deletable by authenticated users"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- 5. RPC function for updating workspace identity securely
CREATE OR REPLACE FUNCTION public.update_workspace_identity(
  target_workspace_id uuid,
  new_name text,
  new_avatar_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  caller_role text;
  updated_row record;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners or admins can update workspace identity';
  END IF;

  UPDATE public.workspaces
  SET
    name = COALESCE(NULLIF(TRIM(new_name), ''), name),
    avatar_url = new_avatar_url
  WHERE id = target_workspace_id
  RETURNING id, name, mode, owner_id, invite_code, avatar_url, created_at INTO updated_row;

  RETURN jsonb_build_object(
    'id', updated_row.id,
    'name', updated_row.name,
    'mode', updated_row.mode,
    'owner_id', updated_row.owner_id,
    'invite_code', updated_row.invite_code,
    'avatar_url', updated_row.avatar_url,
    'created_at', updated_row.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_identity(uuid, text, text) TO authenticated, service_role;
