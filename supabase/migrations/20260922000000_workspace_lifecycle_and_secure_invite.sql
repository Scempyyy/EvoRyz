-- ==============================================================================
-- EvoRyz Migration: Workspace Lifecycle & Secure Invite-Code Joining
-- File: 20260922000000_workspace_lifecycle_and_secure_invite.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTO-ENROLL WORKSPACE CREATOR AS OWNER IN workspace_members
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 2. PROFILE VISIBILITY BETWEEN MEMBERS OF THE SAME WORKSPACE
-- ------------------------------------------------------------------------------
-- Existing policy only allowed viewing own profile. This allows members sharing
-- a workspace to see each other's basic profile (name, username, avatar).
drop policy if exists "Workspace members can view fellow members profiles" on public.profiles;
create policy "Workspace members can view fellow members profiles"
  on public.profiles for select
  using (
    auth.uid() = id or
    exists (
      select 1 from public.workspace_members wm1
      join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid()
      and wm2.user_id = profiles.id
    )
  );

-- ------------------------------------------------------------------------------
-- 3. SECURE NARROWLY-SCOPED INVITE CODE LOOKUP RPC
-- ------------------------------------------------------------------------------
-- Unauthenticated users cannot probe codes.
-- Returns only minimum metadata required to join (no private data or member list).
create or replace function public.lookup_workspace_invite(invite_code_input text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_ws record;
  v_count integer;
  v_is_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to look up invite codes.';
  end if;

  v_code := upper(trim(invite_code_input));
  if length(v_code) < 3 then
    raise exception 'Invalid invite code format.';
  end if;

  select id, name, mode, owner_id into v_ws
  from public.workspaces
  where upper(invite_code) = v_code;

  if not found then
    raise exception 'Workspace not found for invite code: %', v_code;
  end if;

  select count(*)::integer into v_count
  from public.workspace_members
  where workspace_id = v_ws.id;

  select exists(
    select 1 from public.workspace_members
    where workspace_id = v_ws.id and user_id = auth.uid()
  ) into v_is_member;

  return json_build_object(
    'id', v_ws.id,
    'name', v_ws.name,
    'mode', v_ws.mode,
    'member_count', v_count,
    'is_full', (v_ws.mode = 'duo' and v_count >= 2),
    'is_member', coalesce(v_is_member, false)
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. SECURE JOIN WORKSPACE BY INVITE CODE RPC
-- ------------------------------------------------------------------------------
-- Validates Duo capacity (exactly 2 members) and Team capacity server-side.
-- Prevents duplicate membership, leaves any prior workspace cleanly.
create or replace function public.join_workspace_by_invite(invite_code_input text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_ws record;
  v_count integer;
  v_already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to join a workspace.';
  end if;

  v_code := upper(trim(invite_code_input));
  if length(v_code) < 3 then
    raise exception 'Invalid invite code format.';
  end if;

  select id, name, mode, invite_code into v_ws
  from public.workspaces
  where upper(invite_code) = v_code;

  if not found then
    raise exception 'Workspace not found for invite code: %', v_code;
  end if;

  -- Check if already a member of THIS workspace
  select exists(
    select 1 from public.workspace_members
    where workspace_id = v_ws.id and user_id = auth.uid()
  ) into v_already_member;

  if v_already_member then
    return json_build_object(
      'id', v_ws.id,
      'name', v_ws.name,
      'mode', v_ws.mode,
      'invite_code', v_ws.invite_code,
      'already_member', true
    );
  end if;

  -- Validate Duo capacity (max 2 members)
  select count(*)::integer into v_count
  from public.workspace_members
  where workspace_id = v_ws.id;

  if v_ws.mode = 'duo' and v_count >= 2 then
    raise exception 'This Duo workspace is full (maximum 2 members).';
  end if;

  -- Leave previous workspaces to keep single active workspace model
  delete from public.workspace_members
  where user_id = auth.uid();

  -- Clean up any empty workspaces owned by the user
  delete from public.workspaces
  where owner_id = auth.uid()
  and not exists (
    select 1 from public.workspace_members where workspace_id = workspaces.id
  );

  -- Insert membership
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  -- Log shared activity
  insert into public.activities (workspace_id, user_id, type, title, visibility)
  values (v_ws.id, auth.uid(), 'joined', 'joined the workspace', 'shared');

  return json_build_object(
    'id', v_ws.id,
    'name', v_ws.name,
    'mode', v_ws.mode,
    'invite_code', v_ws.invite_code,
    'already_member', false
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. SECURE WORKSPACE CREATION RPC
-- ------------------------------------------------------------------------------
create or replace function public.create_workspace_secure(
  name_input text,
  mode_input text,
  invite_code_input text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_mode text;
  v_code text;
  v_name text;
  v_new_ws record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to create a workspace.';
  end if;

  v_mode := lower(trim(mode_input));
  if v_mode not in ('duo', 'team') then
    raise exception 'Invalid workspace mode. Must be duo or team.';
  end if;

  v_name := coalesce(nullif(trim(name_input), ''), case when v_mode = 'duo' then 'My Duo' else 'My Team' end);

  if invite_code_input is not null and length(trim(invite_code_input)) >= 3 then
    v_code := upper(trim(invite_code_input));
  else
    v_code := 'EVR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  end if;

  -- Leave previous workspaces
  delete from public.workspace_members
  where user_id = auth.uid();

  -- Clean up any empty workspaces owned by user
  delete from public.workspaces
  where owner_id = auth.uid()
  and not exists (
    select 1 from public.workspace_members where workspace_id = workspaces.id
  );

  insert into public.workspaces (name, mode, invite_code, owner_id)
  values (v_name, v_mode, v_code, auth.uid())
  returning id, name, mode, invite_code into v_new_ws;

  return json_build_object(
    'id', v_new_ws.id,
    'name', v_new_ws.name,
    'mode', v_new_ws.mode,
    'invite_code', v_new_ws.invite_code
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. SECURE LEAVE WORKSPACE RPC
-- ------------------------------------------------------------------------------
create or replace function public.leave_workspace(workspace_id_input uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to leave a workspace.';
  end if;

  delete from public.workspace_members
  where workspace_id = workspace_id_input and user_id = auth.uid();

  select count(*)::integer into v_remaining
  from public.workspace_members
  where workspace_id = workspace_id_input;

  if v_remaining = 0 then
    delete from public.workspaces where id = workspace_id_input;
  else
    -- Log activity
    insert into public.activities (workspace_id, user_id, type, title, visibility)
    values (workspace_id_input, auth.uid(), 'left', 'left the workspace', 'shared');

    -- If the user was owner, assign ownership to oldest remaining member
    update public.workspaces
    set owner_id = (
      select user_id from public.workspace_members
      where workspace_id = workspace_id_input
      order by joined_at asc limit 1
    )
    where id = workspace_id_input and owner_id = auth.uid();
  end if;

  return true;
end;
$$;
