-- ==============================================================================
-- EvoRyz Migration: Non-Destructive Schema Reconciliation, Profiles & Workspace Guards
-- File: 20260922160000_ensure_user_profile_and_handle_new_user.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES COMPATIBILITY & BACKFILL
-- ------------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;

-- Sync name and display_name bidirectionally
update public.profiles
set name = display_name
where name is null and display_name is not null;

update public.profiles
set display_name = name
where display_name is null and name is not null;

-- Populate missing emails from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- ------------------------------------------------------------------------------
-- 2. RECONCILE TASKS, HABITS, AND JOURNAL OWNERSHIP
-- ------------------------------------------------------------------------------
-- Tasks: add user_id and app columns if missing
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists date text;
alter table public.tasks add column if not exists completed boolean default false;
alter table public.tasks add column if not exists category text;
alter table public.tasks add column if not exists streak integer default 0;
alter table public.tasks add column if not exists updated_at timestamptz default now();

update public.tasks set user_id = owner_id where user_id is null and owner_id is not null;
update public.tasks set completed = is_completed where completed is null and is_completed is not null;
update public.tasks set date = due_date where date is null and due_date is not null;

-- Habits: add user_id and app columns if missing
alter table public.habits add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.habits add column if not exists type text default 'build';
alter table public.habits add column if not exists frequency text default 'daily';
alter table public.habits add column if not exists current_streak integer default 0;
alter table public.habits add column if not exists best_streak integer default 0;
alter table public.habits add column if not exists completed_today boolean default false;
alter table public.habits add column if not exists history jsonb default '[]'::jsonb;
alter table public.habits add column if not exists updated_at timestamptz default now();

update public.habits set user_id = owner_id where user_id is null and owner_id is not null;

-- Journal Entries: add user_id and cipher columns if missing
alter table public.journal_entries add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.journal_entries add column if not exists encrypted_content text;
alter table public.journal_entries add column if not exists iv text;
alter table public.journal_entries add column if not exists tag text;
alter table public.journal_entries add column if not exists algorithm text default 'AES-GCM-256';
alter table public.journal_entries add column if not exists entry_date text;

update public.journal_entries set user_id = owner_id where user_id is null and owner_id is not null;

-- Ensure journal_security table exists
create table if not exists public.journal_security (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  salt text not null,
  verifier_hash text not null,
  iterations integer default 100000 not null,
  failed_attempts integer default 0 not null,
  locked_until timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.journal_security enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'journal_security' and policyname = 'Users can view their own journal security') then
    create policy "Users can view their own journal security" on public.journal_security for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'journal_security' and policyname = 'Users can insert their own journal security') then
    create policy "Users can insert their own journal security" on public.journal_security for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'journal_security' and policyname = 'Users can update their own journal security') then
    create policy "Users can update their own journal security" on public.journal_security for update using (user_id = auth.uid());
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. ENSURE_PROFILE_EXISTS (COMPATIBLE WITH NAME & DISPLAY_NAME)
-- ------------------------------------------------------------------------------
create or replace function public.ensure_profile_exists(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user record;
  v_email text;
  v_name text;
  v_base_username text;
  v_username text;
  v_avatar text;
  v_count integer := 0;
begin
  if target_user_id is null then
    return;
  end if;

  select id, email, raw_user_meta_data into v_user
  from auth.users
  where id = target_user_id;

  if not found then
    return;
  end if;

  v_email := v_user.email;
  v_name := coalesce(
    v_user.raw_user_meta_data->>'full_name',
    v_user.raw_user_meta_data->>'name',
    case when v_email is not null and v_email != '' then split_part(v_email, '@', 1) else 'User' end
  );
  v_avatar := coalesce(
    v_user.raw_user_meta_data->>'avatar_url',
    v_user.raw_user_meta_data->>'picture',
    ''
  );

  v_base_username := lower(regexp_replace(
    coalesce(
      v_user.raw_user_meta_data->>'user_name',
      v_user.raw_user_meta_data->>'username',
      case when v_email is not null and v_email != '' then split_part(v_email, '@', 1) else 'user' end
    ),
    '[^a-z0-9_]', '', 'g'
  ));
  if v_base_username is null or length(v_base_username) = 0 then
    v_base_username := 'user';
  end if;

  v_username := v_base_username;
  while exists (select 1 from public.profiles where username = v_username and id != target_user_id) loop
    v_count := v_count + 1;
    v_username := v_base_username || v_count::text;
    if v_count > 50 then
      v_username := v_base_username || '_' || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  -- Insert or update existing profile row cleanly
  insert into public.profiles (id, email, name, display_name, username, avatar_url, updated_at)
  values (target_user_id, v_email, v_name, v_name, v_username, v_avatar, now())
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    name = coalesce(public.profiles.name, excluded.name, public.profiles.display_name),
    display_name = coalesce(public.profiles.display_name, excluded.display_name, public.profiles.name),
    avatar_url = coalesce(nullif(public.profiles.avatar_url, ''), excluded.avatar_url);
end;
$$;

grant execute on function public.ensure_profile_exists(uuid) to authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 4. TRIGGER FOR NEW AUTH SIGNUPS
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
begin
  perform public.ensure_profile_exists(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT BACKFILL FOR ALL EXISTING AUTH.USERS
-- ------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from auth.users where id not in (select id from public.profiles) loop
    perform public.ensure_profile_exists(r.id);
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 6. UPDATE handle_new_workspace TO ENSURE CREATOR PROFILE EXISTS
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
begin
  perform public.ensure_profile_exists(new.owner_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. UPDATE create_workspace_secure WITH PROFILE GUARD
-- ------------------------------------------------------------------------------
create or replace function public.create_workspace_secure(
  name_input text,
  mode_input text,
  invite_code_input text default null
)
returns json
language plpgsql
security definer set search_path = public, auth
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

  -- Ensure creator profile exists prior to membership insertion
  perform public.ensure_profile_exists(auth.uid());

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
-- 8. UPDATE join_workspace_by_invite WITH PROFILE GUARD
-- ------------------------------------------------------------------------------
create or replace function public.join_workspace_by_invite(invite_code_input text)
returns json
language plpgsql
security definer set search_path = public, auth
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

  -- Ensure joining user profile exists prior to membership insertion
  perform public.ensure_profile_exists(auth.uid());

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
