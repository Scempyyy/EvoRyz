-- ==============================================================================
-- EvoRyz Migration: Foreign Key Constraint for Workspace Members & Profiles
-- File: 20260922150000_workspace_members_profiles_fk.sql
-- ==============================================================================

-- Safe addition of foreign key from workspace_members(user_id) to profiles(id)
-- Enables native PostgREST embedding: .from('workspace_members').select('..., profiles(...)')
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_workspace_members_profiles'
  ) then
    alter table public.workspace_members
      add constraint fk_workspace_members_profiles
      foreign key (user_id) references public.profiles(id)
      on delete cascade;
  end if;
exception when others then
  -- In case a member does not yet have a profile row or partial RLS, safe fallback
  null;
end $$;
