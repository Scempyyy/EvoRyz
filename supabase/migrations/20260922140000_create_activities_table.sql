-- ==============================================================================
-- EvoRyz Migration: Create Activities Table, RLS Policies, and Performance Indexes
-- File: 20260922140000_create_activities_table.sql
-- ==============================================================================

-- 1. Create public.activities table if missing
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type text not null,
  title text not null,
  visibility text not null check (visibility in ('private', 'shared')) default 'shared',
  created_at timestamptz default now() not null
);

-- 2. Enable Row Level Security
alter table public.activities enable row level security;

-- 3. Policies: Strictly protect private activities and enforce workspace boundaries
drop policy if exists "Activities access policy" on public.activities;
drop policy if exists "Users can insert their activities" on public.activities;
drop policy if exists "Users can update their activities" on public.activities;
drop policy if exists "Users can delete their activities" on public.activities;

-- Select: Owner can always view their own activities (private or shared).
-- Other workspace members can ONLY view activities where visibility = 'shared'.
create policy "Activities access policy"
  on public.activities for select
  using (
    user_id = auth.uid() or
    (
      visibility = 'shared' and
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = activities.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

-- Insert: Users can only log activities under their own user_id
create policy "Users can insert their activities"
  on public.activities for insert
  with check (user_id = auth.uid());

-- Update: Users can only edit their own activities
create policy "Users can update their activities"
  on public.activities for update
  using (user_id = auth.uid());

-- Delete: Users can only delete their own activities
create policy "Users can delete their activities"
  on public.activities for delete
  using (user_id = auth.uid());

-- 4. Performance Indexes
create index if not exists idx_activities_workspace_created
  on public.activities (workspace_id, created_at desc);

create index if not exists idx_activities_user_created
  on public.activities (user_id, created_at desc);

-- 5. Safe Realtime publication registration
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activities'
    ) then
      alter publication supabase_realtime add table public.activities;
    end if;
  end if;
end $$;

-- 6. Safe update of join_workspace_by_invite and leave_workspace with exception handling
-- Ensures workspace lifecycle actions will succeed seamlessly even under partial edge cases
create or replace function public.join_workspace_by_invite(invite_code_input text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_clean_code text;
  v_ws record;
  v_member_count integer;
  v_is_already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_clean_code := upper(trim(invite_code_input));
  if length(v_clean_code) = 0 then
    raise exception 'Invalid invite code';
  end if;

  select id, name, mode, invite_code into v_ws
  from public.workspaces
  where upper(trim(invite_code)) = v_clean_code;

  if v_ws.id is null then
    raise exception 'Workspace not found. Check the invite code and try again.';
  end if;

  select exists(
    select 1 from public.workspace_members
    where workspace_id = v_ws.id and user_id = auth.uid()
  ) into v_is_already_member;

  if v_is_already_member then
    return json_build_object(
      'id', v_ws.id,
      'name', v_ws.name,
      'mode', v_ws.mode,
      'invite_code', v_ws.invite_code,
      'already_member', true
    );
  end if;

  select count(*)::integer into v_member_count
  from public.workspace_members
  where workspace_id = v_ws.id;

  if v_ws.mode = 'duo' and v_member_count >= 2 then
    raise exception 'This Duo workspace is full (maximum 2 members).';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  -- Safe activity logging: failure must never abort workspace join
  begin
    insert into public.activities (workspace_id, user_id, type, title, visibility)
    values (v_ws.id, auth.uid(), 'joined', 'joined the workspace', 'shared');
  exception when others then
    null;
  end;

  return json_build_object(
    'id', v_ws.id,
    'name', v_ws.name,
    'mode', v_ws.mode,
    'invite_code', v_ws.invite_code,
    'already_member', false
  );
end;
$$;

create or replace function public.leave_workspace(workspace_id_input uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.workspace_members
  where workspace_id = workspace_id_input and user_id = auth.uid();

  select count(*)::integer into v_remaining
  from public.workspace_members
  where workspace_id = workspace_id_input;

  if v_remaining = 0 then
    delete from public.workspaces where id = workspace_id_input;
  else
    begin
      insert into public.activities (workspace_id, user_id, type, title, visibility)
      values (workspace_id_input, auth.uid(), 'left', 'left the workspace', 'shared');
    exception when others then
      null;
    end;

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
