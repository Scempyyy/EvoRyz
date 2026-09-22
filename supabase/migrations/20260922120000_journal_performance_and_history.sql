-- ==============================================================================
-- EvoRyz Migration: Journal Performance, Indexes & Chronological Day Queries
-- File: 20260922120000_journal_performance_and_history.sql
-- ==============================================================================

-- 1. Optimized chronological index for journal entries
-- In existing Supabase schema, public.journal_entries uses 'owner_id' for account ownership
create index if not exists idx_journal_entries_owner_created
  on public.journal_entries (owner_id, created_at desc);

-- 2. Dynamically index date and security credentials if present in schema
do $$
begin
  -- Index entry_date if present on journal_entries
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'entry_date'
  ) then
    execute 'create index if not exists idx_journal_entries_owner_date_created on public.journal_entries (owner_id, entry_date, created_at desc)';
  end if;

  -- Index journal_security if table exists (supporting owner_id or user_id)
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'journal_security'
  ) then
    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'journal_security' and column_name = 'owner_id'
    ) then
      execute 'create index if not exists idx_journal_security_owner on public.journal_security (owner_id)';
    elsif exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'journal_security' and column_name = 'user_id'
    ) then
      execute 'create index if not exists idx_journal_security_user on public.journal_security (user_id)';
    end if;
  end if;
end $$;
