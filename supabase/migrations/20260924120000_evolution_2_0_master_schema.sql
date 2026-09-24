-- ==============================================================================
-- Migration: 20260924120000_evolution_2_0_master_schema.sql
-- Description: Evolution 2.0 Master Schema:
--   1. Workspaces theme support
--   2. Messages pinning, message_type expansion (support 'ai')
--   3. One-team-per-user unique constraint & role check ('owner', 'admin', 'member')
--   4. Workspace member mute and notification preferences
--   5. Realtime presence & last_seen in profiles
--   6. Audit logs table and RPC triggers
--   7. Team goals & challenges
--   8. Direct messages table with realtime publication
--   9. Saved messages (bookmarks)
--  10. Team admin management RPCs (role change, muting, kick, theme)
--  11. Account deletion RPC
-- ==============================================================================

-- 1. Workspaces theme column
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS theme text DEFAULT 'default';
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_theme_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_theme_check CHECK (theme IN ('default', 'harry_potter', 'stranger_things'));

-- 2. Message enhancements: pinning, saved, message_type
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'video', 'file', 'voice', 'system', 'ai'));

-- 3. Profiles presence & last_seen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- 4. Workspace members enhancements
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS notifications_muted boolean DEFAULT false;

-- Update role check to include 'admin'
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

-- Enforce ONE active team per person at database level
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_one_team_per_user;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_one_team_per_user UNIQUE (user_id);

-- 5. Saved messages / bookmarks
CREATE TABLE IF NOT EXISTS public.saved_messages (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

ALTER TABLE public.saved_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved messages" ON public.saved_messages;
CREATE POLICY "Users can view own saved messages"
ON public.saved_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can bookmark messages" ON public.saved_messages;
CREATE POLICY "Users can bookmark messages"
ON public.saved_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove bookmarks" ON public.saved_messages;
CREATE POLICY "Users can remove bookmarks"
ON public.saved_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Developer Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs viewable by workspace admins and owners" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by workspace admins and owners"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = audit_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- 7. Team Goals & Challenges
CREATE TABLE IF NOT EXISTS public.team_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  target integer NOT NULL DEFAULT 100,
  current integer NOT NULL DEFAULT 0,
  unit text DEFAULT '%',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace team goals" ON public.team_goals;
CREATE POLICY "Members can view workspace team goals"
ON public.team_goals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = team_goals.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can create workspace team goals" ON public.team_goals;
CREATE POLICY "Members can create workspace team goals"
ON public.team_goals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = team_goals.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can update workspace team goals" ON public.team_goals;
CREATE POLICY "Members can update workspace team goals"
ON public.team_goals FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = team_goals.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can delete workspace team goals" ON public.team_goals;
CREATE POLICY "Admins can delete workspace team goals"
ON public.team_goals FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = team_goals.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- 8. Direct Messages Table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  attachment_url text,
  thumbnail_url text,
  is_pinned boolean DEFAULT false,
  reactions jsonb DEFAULT '[]'::jsonb,
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON public.direct_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON public.direct_messages (recipient_id);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view direct messages they participate in" ON public.direct_messages;
CREATE POLICY "Users can view direct messages they participate in"
ON public.direct_messages FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Participants can update direct messages" ON public.direct_messages;
CREATE POLICY "Participants can update direct messages"
ON public.direct_messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Senders can delete direct messages" ON public.direct_messages;
CREATE POLICY "Senders can delete direct messages"
ON public.direct_messages FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Add direct_messages to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_goals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_goals;
  END IF;
END $$;

-- 9. RPC Functions for Team Admin

-- A. Set Workspace Theme (Owner/Admin)
CREATE OR REPLACE FUNCTION public.set_workspace_theme(
  target_workspace_id uuid,
  new_theme text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  caller_role text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_theme NOT IN ('default', 'harry_potter', 'stranger_things') THEN
    RAISE EXCEPTION 'Invalid workspace theme: %', new_theme;
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners or admins can change chat themes';
  END IF;

  UPDATE public.workspaces
  SET theme = new_theme
  WHERE id = target_workspace_id;

  -- Audit log
  INSERT INTO public.audit_logs (workspace_id, actor_id, action, details)
  VALUES (target_workspace_id, calling_user_id, 'change_theme', jsonb_build_object('theme', new_theme));

  RETURN jsonb_build_object('success', true, 'theme', new_theme);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_workspace_theme(uuid, text) TO authenticated, service_role;

-- B. Set Workspace Member Role (Owner can promote/demote admin; admin can promote member)
CREATE OR REPLACE FUNCTION public.set_workspace_member_role(
  target_workspace_id uuid,
  target_user_id uuid,
  new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  caller_role text;
  target_current_role text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to manage roles';
  END IF;

  SELECT role INTO target_current_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  IF target_current_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;

  -- Only owners can promote/demote admins or transfer ownership
  IF (new_role IN ('owner', 'admin') OR target_current_role IN ('owner', 'admin')) AND caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only workspace owner can promote or demote admins';
  END IF;

  -- If transferring ownership
  IF new_role = 'owner' THEN
    UPDATE public.workspace_members
    SET role = 'admin'
    WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

    UPDATE public.workspaces
    SET owner_id = target_user_id
    WHERE id = target_workspace_id;
  END IF;

  UPDATE public.workspace_members
  SET role = new_role
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  INSERT INTO public.audit_logs (workspace_id, actor_id, action, details)
  VALUES (target_workspace_id, calling_user_id, 'set_role', jsonb_build_object('target_user', target_user_id, 'role', new_role));

  RETURN jsonb_build_object('success', true, 'target_user_id', target_user_id, 'new_role', new_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_workspace_member_role(uuid, uuid, text) TO authenticated, service_role;

-- C. Set Workspace Member Muted (Owner/Admin)
CREATE OR REPLACE FUNCTION public.set_workspace_member_muted(
  target_workspace_id uuid,
  target_user_id uuid,
  muted boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  caller_role text;
  target_role text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to mute members';
  END IF;

  SELECT role INTO target_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Workspace owner cannot be muted';
  END IF;

  UPDATE public.workspace_members
  SET is_muted = muted
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  INSERT INTO public.audit_logs (workspace_id, actor_id, action, details)
  VALUES (target_workspace_id, calling_user_id, CASE WHEN muted THEN 'mute_member' ELSE 'unmute_member' END, jsonb_build_object('target_user', target_user_id));

  RETURN jsonb_build_object('success', true, 'target_user_id', target_user_id, 'is_muted', muted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_workspace_member_muted(uuid, uuid, boolean) TO authenticated, service_role;

-- D. Remove Member / Leave Workspace
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  caller_role text;
  target_role text;
  target_name text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  SELECT role INTO target_role
  FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;

  -- User leaving themselves or admin/owner kicking
  IF calling_user_id != target_user_id THEN
    IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Insufficient permissions to remove members';
    END IF;
    IF target_role = 'owner' THEN
      RAISE EXCEPTION 'Workspace owner cannot be removed';
    END IF;
    IF caller_role = 'admin' AND target_role = 'admin' THEN
      RAISE EXCEPTION 'Admins cannot remove other admins';
    END IF;
  END IF;

  -- Get target user display name
  SELECT COALESCE(name, username, 'A member') INTO target_name
  FROM public.profiles
  WHERE id = target_user_id;

  DELETE FROM public.workspace_members
  WHERE workspace_id = target_workspace_id AND user_id = target_user_id;

  -- Add system message in chat
  INSERT INTO public.messages (workspace_id, sender_id, message_type, content)
  VALUES (
    target_workspace_id,
    calling_user_id,
    'system',
    CASE 
      WHEN calling_user_id = target_user_id THEN target_name || ' left the team'
      ELSE target_name || ' was removed from the team'
    END
  );

  INSERT INTO public.audit_logs (workspace_id, actor_id, action, details)
  VALUES (target_workspace_id, calling_user_id, 'remove_member', jsonb_build_object('target_user', target_user_id, 'kicked', calling_user_id != target_user_id));

  RETURN jsonb_build_object('success', true, 'removed_user_id', target_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated, service_role;

-- E. Toggle Workspace Notifications (Per-team mute)
CREATE OR REPLACE FUNCTION public.toggle_workspace_notifications(
  target_workspace_id uuid,
  mute_notifications boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.workspace_members
  SET notifications_muted = mute_notifications
  WHERE workspace_id = target_workspace_id AND user_id = calling_user_id;

  RETURN jsonb_build_object('success', true, 'notifications_muted', mute_notifications);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_workspace_notifications(uuid, boolean) TO authenticated, service_role;

-- F. Update Presence RPC
CREATE OR REPLACE FUNCTION public.update_user_presence(
  user_online boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    is_online = user_online,
    last_seen = now()
  WHERE id = calling_user_id;

  RETURN jsonb_build_object('success', true, 'is_online', user_online, 'last_seen', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_presence(boolean) TO authenticated, service_role;

-- G. Pin / Unpin Message
CREATE OR REPLACE FUNCTION public.toggle_pin_message(
  target_message_id uuid,
  pin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  msg_workspace_id uuid;
  caller_role text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO msg_workspace_id
  FROM public.messages
  WHERE id = target_message_id;

  IF msg_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT role INTO caller_role
  FROM public.workspace_members
  WHERE workspace_id = msg_workspace_id AND user_id = calling_user_id;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE public.messages
  SET
    is_pinned = pin,
    pinned_by = CASE WHEN pin THEN calling_user_id ELSE NULL END,
    pinned_at = CASE WHEN pin THEN now() ELSE NULL END
  WHERE id = target_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', target_message_id, 'is_pinned', pin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_pin_message(uuid, boolean) TO authenticated, service_role;

-- H. Permanent Account Deletion RPC
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Remove memberships
  DELETE FROM public.workspace_members WHERE user_id = calling_user_id;

  -- 2. Clean up owned workspaces if empty
  DELETE FROM public.workspaces
  WHERE owner_id = calling_user_id
    AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = workspaces.id);

  -- 3. Delete user data
  DELETE FROM public.tasks WHERE owner_id = calling_user_id;
  DELETE FROM public.habits WHERE owner_id = calling_user_id;
  DELETE FROM public.meals WHERE owner_id = calling_user_id;
  DELETE FROM public.journal_entries WHERE owner_id = calling_user_id;
  DELETE FROM public.journal_security WHERE user_id = calling_user_id;
  DELETE FROM public.activities WHERE user_id = calling_user_id;
  DELETE FROM public.saved_messages WHERE user_id = calling_user_id;
  DELETE FROM public.direct_messages WHERE sender_id = calling_user_id OR recipient_id = calling_user_id;
  DELETE FROM public.profiles WHERE id = calling_user_id;
  DELETE FROM auth.users WHERE id = calling_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated, service_role;
