-- ==============================================================================
-- EvoRyz Migration: Workspace Invite Code Column & Username Uniqueness
-- File: 20260922130000_workspace_invite_code_and_username.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WORKSPACE INVITE CODE COLUMN & CONSTRAINTS
-- ------------------------------------------------------------------------------
-- Ensure invite_code column exists on public.workspaces
alter table public.workspaces add column if not exists invite_code text;

-- Populate existing rows where invite_code is null
update public.workspaces
set invite_code = 'EVR-' || upper(substr(md5(random()::text || id::text), 1, 6))
where invite_code is null;

-- Set NOT NULL
alter table public.workspaces alter column invite_code set not null;

-- Add unique constraint if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_invite_code_key'
  ) then
    alter table public.workspaces add constraint workspaces_invite_code_key unique (invite_code);
  end if;
end $$;

-- Index for fast invite code lookup
create index if not exists idx_workspaces_invite_code on public.workspaces (upper(trim(invite_code)));

-- ------------------------------------------------------------------------------
-- 2. PROFILES USERNAME UNIQUE INDEX
-- ------------------------------------------------------------------------------
-- Enforce server-side case-insensitive username uniqueness
create unique index if not exists idx_profiles_username_lower_unique
  on public.profiles (lower(trim(username)))
  where username is not null and trim(username) <> '';

-- ------------------------------------------------------------------------------
-- 3. SECURE SERVER-SIDE USERNAME UPDATE RPC
-- ------------------------------------------------------------------------------
create or replace function public.update_username(new_username text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid;
  v_cleaned text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_cleaned := lower(trim(new_username));

  -- Validation: 3-20 characters, only alphanumeric and underscore
  if length(v_cleaned) < 3 or length(v_cleaned) > 20 then
    raise exception 'Username must be between 3 and 20 characters';
  end if;

  if v_cleaned !~ '^[a-z0-9_]+$' then
    raise exception 'Username may only contain letters, numbers, and underscores';
  end if;

  -- Check uniqueness against other users
  if exists (
    select 1 from public.profiles
    where id <> v_uid and lower(trim(username)) = v_cleaned
  ) then
    raise exception 'Username is already taken';
  end if;

  -- Update profile
  update public.profiles
  set username = v_cleaned,
      updated_at = now()
  where id = v_uid;

  return json_build_object(
    'success', true,
    'username', v_cleaned
  );
end;
$$;

grant execute on function public.update_username(text) to authenticated;
