-- 20260923000000_enable_realtime_replica_identity.sql
-- 1. Ensure messages table has full replica identity for complete Realtime CDC replication
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;

-- 2. Explicit schema and table permission grants for authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- 3. Dedicated security definer RPC for resolving workspace members
-- Guarantees that enrolled members of a workspace always resolve the complete member list
CREATE OR REPLACE FUNCTION public.get_workspace_members(workspace_id_input uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_id_input AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT coalesce(json_agg(
    json_build_object(
      'id', wm.user_id,
      'name', coalesce(p.name, p.display_name, case when wm.role = 'owner' then 'Owner' else 'Member' end),
      'avatar', coalesce(p.avatar_url, substring(coalesce(p.name, 'M') from 1 for 1)),
      'role', wm.role
    ) ORDER BY wm.joined_at ASC
  ), '[]'::json) INTO v_result
  FROM public.workspace_members wm
  LEFT JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = workspace_id_input;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated, service_role;
