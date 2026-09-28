-- ==============================================================================
-- Migration: 20260928120000_friend_system_and_display_name.sql
-- Description:
--   1. Display Name support in public.profiles
--   2. Proper Friend System (friendships & friend_requests) separate from workspaces
--   3. Friend Pings with rate limiting / cooldown
--   4. Strict RLS and zero data leakage to friends
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DISPLAY NAME SUPPORT IN PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill display_name from existing name
UPDATE public.profiles
SET display_name = name
WHERE display_name IS NULL AND name IS NOT NULL;

-- RPC to update display name with validation
CREATE OR REPLACE FUNCTION public.update_display_name(new_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  cleaned_name text;
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  cleaned_name := trim(new_display_name);

  IF length(cleaned_name) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Display name cannot be empty');
  END IF;

  IF length(cleaned_name) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Display name cannot exceed 50 characters');
  END IF;

  UPDATE public.profiles
  SET
    display_name = cleaned_name,
    name = cleaned_name,
    updated_at = now()
  WHERE id = calling_user_id;

  RETURN jsonb_build_object('success', true, 'display_name', cleaned_name);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. FRIEND REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_no_self CHECK (sender_id <> receiver_id)
);

-- Ensure only one pending request between any two users in either direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_unique
  ON public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests (receiver_id);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view their own friend requests"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

DROP POLICY IF EXISTS "Participants can update friend requests" ON public.friend_requests;
CREATE POLICY "Participants can update friend requests"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Participants can delete friend requests" ON public.friend_requests;
CREATE POLICY "Participants can delete friend requests"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ------------------------------------------------------------------------------
-- 3. FRIENDSHIPS TABLE
-- Symmetrically stored (user_id, friend_id) for O(1) indexed friend lookups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (user_id <> friend_id),
  CONSTRAINT friendships_user_friend_uniq UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships (friend_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert their own friendships" ON public.friendships;
CREATE POLICY "Users can insert their own friendships"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ------------------------------------------------------------------------------
-- 4. FRIEND PINGS TABLE
-- Lightweight notification action with timestamp for rate limiting
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_pings_no_self CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_pings_receiver ON public.friend_pings (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_pings_rate_limit ON public.friend_pings (sender_id, receiver_id, created_at DESC);

ALTER TABLE public.friend_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view friend pings sent to them or by them" ON public.friend_pings;
CREATE POLICY "Users can view friend pings sent to them or by them"
  ON public.friend_pings FOR SELECT
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "Friends can send pings" ON public.friend_pings;
CREATE POLICY "Friends can send pings"
  ON public.friend_pings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE user_id = auth.uid() AND friend_id = friend_pings.receiver_id
    )
  );

-- ------------------------------------------------------------------------------
-- 5. REALTIME PUBLICATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_pings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_pings;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC FUNCTIONS FOR FRIEND SYSTEM
-- ------------------------------------------------------------------------------

-- Send Friend Request by username
CREATE OR REPLACE FUNCTION public.send_friend_request(target_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  target_user record;
  existing_request record;
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find target profile by username (case-insensitive)
  SELECT id, username, name, avatar_url INTO target_user
  FROM public.profiles
  WHERE lower(username) = lower(trim(replace(target_username, '@', '')));

  IF target_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent sending request to oneself
  IF target_user.id = calling_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot send a friend request to yourself');
  END IF;

  -- Check if already friends
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = calling_user_id AND friend_id = target_user.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already friends with this user');
  END IF;

  -- Check for existing pending request
  SELECT id, sender_id, receiver_id INTO existing_request
  FROM public.friend_requests
  WHERE status = 'pending'
    AND ((sender_id = calling_user_id AND receiver_id = target_user.id)
      OR (sender_id = target_user.id AND receiver_id = calling_user_id));

  IF existing_request.id IS NOT NULL THEN
    IF existing_request.sender_id = calling_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'A pending friend request has already been sent');
    ELSE
      -- Target already sent caller a request -> automatically accept it!
      UPDATE public.friend_requests
      SET status = 'accepted', updated_at = now()
      WHERE id = existing_request.id;

      INSERT INTO public.friendships (user_id, friend_id)
      VALUES (calling_user_id, target_user.id), (target_user.id, calling_user_id)
      ON CONFLICT (user_id, friend_id) DO NOTHING;

      RETURN jsonb_build_object('success', true, 'status', 'accepted', 'message', 'Friend request accepted automatically');
    END IF;
  END IF;

  -- Insert new pending request
  INSERT INTO public.friend_requests (sender_id, receiver_id, status)
  VALUES (calling_user_id, target_user.id, 'pending');

  RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Friend request sent');
END;
$$;

-- Respond to Friend Request (Accept or Decline)
CREATE OR REPLACE FUNCTION public.respond_friend_request(request_id uuid, accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  req record;
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO req
  FROM public.friend_requests
  WHERE id = request_id;

  IF req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friend request not found');
  END IF;

  -- Only recipient can accept/decline; sender can cancel
  IF req.receiver_id != calling_user_id AND req.sender_id != calling_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friend request is no longer pending');
  END IF;

  IF accept THEN
    IF req.receiver_id != calling_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only recipient can accept friend request');
    END IF;

    UPDATE public.friend_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = request_id;

    -- Create symmetric friendship records
    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (req.sender_id, req.receiver_id), (req.receiver_id, req.sender_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'status', 'accepted');
  ELSE
    -- If sender cancels or recipient declines
    UPDATE public.friend_requests
    SET status = CASE WHEN req.sender_id = calling_user_id THEN 'cancelled' ELSE 'declined' END,
        updated_at = now()
    WHERE id = request_id;

    RETURN jsonb_build_object('success', true, 'status', CASE WHEN req.sender_id = calling_user_id THEN 'cancelled' ELSE 'declined' END);
  END IF;
END;
$$;

-- Remove Friend
CREATE OR REPLACE FUNCTION public.remove_friend(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.friendships
  WHERE (user_id = calling_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = calling_user_id);

  -- Clean up any requests between them
  DELETE FROM public.friend_requests
  WHERE (sender_id = calling_user_id AND receiver_id = target_user_id)
     OR (sender_id = target_user_id AND receiver_id = calling_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Send Friend Ping with 60-second rate limiting
CREATE OR REPLACE FUNCTION public.send_friend_ping(target_friend_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  last_ping timestamptz;
  seconds_since integer;
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF calling_user_id = target_friend_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot ping yourself');
  END IF;

  -- Ensure they are friends
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = calling_user_id AND friend_id = target_friend_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can only ping confirmed friends');
  END IF;

  -- Rate limit check (60 seconds)
  SELECT created_at INTO last_ping
  FROM public.friend_pings
  WHERE sender_id = calling_user_id AND receiver_id = target_friend_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_ping IS NOT NULL THEN
    seconds_since := EXTRACT(EPOCH FROM (now() - last_ping))::integer;
    IF seconds_since < 60 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Please wait before pinging again',
        'cooldown_remaining', (60 - seconds_since)
      );
    END IF;
  END IF;

  INSERT INTO public.friend_pings (sender_id, receiver_id)
  VALUES (calling_user_id, target_friend_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. FOREIGN KEY RELATIONSHIPS FOR POSTGREST EMBEDDING
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_friend_id_fkey'
  ) THEN
    ALTER TABLE public.friendships
      ADD CONSTRAINT friendships_friend_id_fkey
      FOREIGN KEY (friend_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_user_id_fkey'
  ) THEN
    ALTER TABLE public.friendships
      ADD CONSTRAINT friendships_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friend_requests_sender_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friend_requests_receiver_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. UNIFY FRIENDSHIP IN WORKSPACE & WINTER ARC VISIBILITY
-- ------------------------------------------------------------------------------
-- Upgrade is_workspace_friend so that direct friends via public.friendships
-- are also recognized alongside workspace peers across Winter Arc & Leaderboards
CREATE OR REPLACE FUNCTION public.is_workspace_friend(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    -- Direct friendship in public.friendships
    EXISTS (
      SELECT 1
      FROM public.friendships
      WHERE user_id = auth.uid()
        AND friend_id = target_user_id
    )
    OR
    -- Shared workspace peer
    EXISTS (
      SELECT 1
      FROM public.workspace_members m1
      JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = target_user_id
    )
  );
$$;

-- ------------------------------------------------------------------------------
-- 9. STRICT ROW LEVEL SECURITY FOR PROFILES (NO BROAD SELECT)
-- ------------------------------------------------------------------------------
-- Ensure only self, confirmed friends, workspace peers, or friend request
-- participants can directly read a profile row. Arbitrary strangers CANNOT.
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Workspace members can view fellow members profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own, teammate, or friend profiles" ON public.profiles;

CREATE POLICY "Users can view own, teammate, or friend profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- 1. Self
    auth.uid() = id
    OR
    -- 2. Confirmed 1-on-1 friend
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE user_id = auth.uid() AND friend_id = profiles.id
    )
    OR
    -- 3. Shared workspace peer
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
    OR
    -- 4. Friend request participant
    EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE (fr.sender_id = auth.uid() AND fr.receiver_id = profiles.id)
         OR (fr.receiver_id = auth.uid() AND fr.sender_id = profiles.id)
    )
  );

-- ------------------------------------------------------------------------------
-- 10. SECURE NARROW USER SEARCH RPC (ZERO EXPOSURE OF EMAIL OR PRIVATE DATA)
-- ------------------------------------------------------------------------------
-- Allows discovering potential friends by @username without granting arbitrary
-- SELECT access on the profiles table. Returns strictly public display fields.
CREATE OR REPLACE FUNCTION public.search_users_by_username(search_term text, limit_count integer DEFAULT 15)
RETURNS TABLE (
  id uuid,
  username text,
  name text,
  display_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  cleaned text;
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN;
  END IF;

  cleaned := trim(replace(search_term, '@', ''));
  IF length(cleaned) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.name,
    p.display_name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.id <> calling_user_id
    AND (p.username ILIKE ('%' || cleaned || '%') OR p.name ILIKE ('%' || cleaned || '%') OR p.display_name ILIKE ('%' || cleaned || '%'))
  ORDER BY
    -- Exact username match ranks first
    CASE WHEN lower(p.username) = lower(cleaned) THEN 0 ELSE 1 END,
    p.username ASC
  LIMIT least(limit_count, 30);
END;
$$;

-- Explicit privilege restriction:
-- Revoke execution from PUBLIC and anon, grant strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.search_users_by_username(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_users_by_username(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_users_by_username(text, integer) TO authenticated;


