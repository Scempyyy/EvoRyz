-- ==============================================================================
-- EvoRyz Production Database Schema & Row Level Security (RLS)
-- Compatible with PostgreSQL 15+ / Supabase
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  username text unique,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto create profile on auth signup trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. WORKSPACES & MEMBERS
-- ------------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('duo', 'team')),
  invite_code text unique not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' not null,
  joined_at timestamptz default now() not null,
  unique (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "Workspace members can view their workspaces"
  on public.workspaces for select
  using (
    owner_id = auth.uid() or
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
      and workspace_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

create policy "Workspace owners can update workspaces"
  on public.workspaces for update
  using (owner_id = auth.uid());

create policy "Members can view workspace membership"
  on public.workspace_members for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
    )
  );

create policy "Users can join workspace"
  on public.workspace_members for insert
  with check (user_id = auth.uid());

create policy "Users can leave or owners can remove member"
  on public.workspace_members for delete
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id
      and w.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 3. TASKS
-- ------------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null,
  description text,
  visibility text not null check (visibility in ('private', 'shared')) default 'private',
  date text not null,
  completed boolean default false not null,
  category text,
  streak integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.tasks enable row level security;

create policy "Task access policy"
  on public.tasks for select
  using (
    user_id = auth.uid() or
    (
      visibility = 'shared' and
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = tasks.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (user_id = auth.uid());

create policy "Users can update their own tasks"
  on public.tasks for update
  using (user_id = auth.uid());

create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 4. HABITS
-- ------------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  name text not null,
  description text,
  type text not null check (type in ('build', 'avoid')) default 'build',
  visibility text not null check (visibility in ('private', 'shared')) default 'private',
  frequency text default 'daily' not null,
  current_streak integer default 0 not null,
  best_streak integer default 0 not null,
  completed_today boolean default false not null,
  history jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.habits enable row level security;

create policy "Habit access policy"
  on public.habits for select
  using (
    user_id = auth.uid() or
    (
      visibility = 'shared' and
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = habits.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (user_id = auth.uid());

create policy "Users can update their own habits"
  on public.habits for update
  using (user_id = auth.uid());

create policy "Users can delete their own habits"
  on public.habits for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5. GOALS
-- ------------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null,
  description text default '' not null,
  visibility text not null check (visibility in ('private', 'shared')) default 'private',
  progress integer default 0 not null,
  deadline text default 'No deadline' not null,
  priority text default 'medium' check (priority in ('high', 'medium', 'low')) not null,
  category text default 'Personal' not null,
  milestones jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.goals enable row level security;

create policy "Goal access policy"
  on public.goals for select
  using (
    user_id = auth.uid() or
    (
      visibility = 'shared' and
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = goals.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert their own goals"
  on public.goals for insert
  with check (user_id = auth.uid());

create policy "Users can update their own goals"
  on public.goals for update
  using (user_id = auth.uid());

create policy "Users can delete their own goals"
  on public.goals for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. MEALS
-- ------------------------------------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  name text not null,
  type text not null check (type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  calories integer default 0 not null,
  protein integer default 0 not null,
  carbs integer default 0 not null,
  fat integer default 0 not null,
  fiber integer default 0 not null,
  notes text,
  photo_uri text,
  visibility text not null check (visibility in ('private', 'shared')) default 'private',
  date text not null,
  created_at timestamptz default now() not null
);

alter table public.meals enable row level security;

create policy "Meal access policy"
  on public.meals for select
  using (
    user_id = auth.uid() or
    (
      visibility = 'shared' and
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = meals.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert their own meals"
  on public.meals for insert
  with check (user_id = auth.uid());

create policy "Users can update their own meals"
  on public.meals for update
  using (user_id = auth.uid());

create policy "Users can delete their own meals"
  on public.meals for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. MESSAGES (WORKSPACE CHAT)
-- ------------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade not null,
  conversation_id text not null,
  type text default 'text' not null,
  content text not null,
  status text default 'sent' not null,
  reply_to uuid references public.messages(id) on delete set null,
  reactions jsonb default '[]'::jsonb not null,
  uri text,
  thumbnail_uri text,
  attachment_name text,
  mime_type text,
  size integer,
  width integer,
  height integer,
  duration numeric,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Message access policy"
  on public.messages for select
  using (
    sender_id = auth.uid() or
    (
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = messages.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    (
      workspace_id is null or
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = messages.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Senders can edit their own messages"
  on public.messages for update
  using (sender_id = auth.uid());

create policy "Senders can delete their own messages"
  on public.messages for delete
  using (sender_id = auth.uid());

-- Enable Realtime for messages
alter publication supabase_realtime add table public.messages;

-- ------------------------------------------------------------------------------
-- 8. JOURNAL ENTRIES (STRICTLY PRIVATE & ENCRYPTED CIPHERTEXT)
-- ------------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  encrypted_content text not null,
  iv text not null,
  tag text,
  algorithm text default 'AES-GCM-256' not null,
  entry_date text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.journal_entries enable row level security;

create policy "Journal is strictly personal and private"
  on public.journal_entries for select
  using (user_id = auth.uid());

create policy "Users can insert their own journal entries"
  on public.journal_entries for insert
  with check (user_id = auth.uid());

create policy "Users can update their own journal entries"
  on public.journal_entries for update
  using (user_id = auth.uid());

create policy "Users can delete their own journal entries"
  on public.journal_entries for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 9. JOURNAL SECURITY / PIN VERIFIER (PBKDF2 HASH + SALT + RATE LIMITING)
-- ------------------------------------------------------------------------------
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

create policy "Users can view their own journal security"
  on public.journal_security for select
  using (user_id = auth.uid());

create policy "Users can insert their own journal security"
  on public.journal_security for insert
  with check (user_id = auth.uid());

create policy "Users can update their own journal security"
  on public.journal_security for update
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. DAILY SUMMARIES & ACTIVITIES
-- ------------------------------------------------------------------------------
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  date text not null,
  you_percent integer not null,
  shared_percent integer,
  created_at timestamptz default now() not null,
  unique (user_id, date)
);

alter table public.daily_summaries enable row level security;

create policy "Daily summary access policy"
  on public.daily_summaries for select
  using (
    user_id = auth.uid() or
    (
      workspace_id is not null and
      exists (
        select 1 from public.workspace_members
        where workspace_members.workspace_id = daily_summaries.workspace_id
        and workspace_members.user_id = auth.uid()
      )
    )
  );

create policy "Users can upsert their daily summary"
  on public.daily_summaries for insert
  with check (user_id = auth.uid());

create policy "Users can update their daily summary"
  on public.daily_summaries for update
  using (user_id = auth.uid());

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type text not null,
  title text not null,
  visibility text not null check (visibility in ('private', 'shared')) default 'shared',
  created_at timestamptz default now() not null
);

alter table public.activities enable row level security;

create policy "Activities access policy"
  on public.activities for select
  using (
    (visibility = 'shared' and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = activities.workspace_id
      and workspace_members.user_id = auth.uid()
    )) or
    user_id = auth.uid()
  );

create policy "Users can insert their activities"
  on public.activities for insert
  with check (user_id = auth.uid());
