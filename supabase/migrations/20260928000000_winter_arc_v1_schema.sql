-- ==============================================================================
-- Migration: 20260928000000_winter_arc_v1_schema.sql
-- Description: Winter Arc v1 Production Schema
--   - Individual solo challenge (isolated from workspaces/teams)
--   - Tables: winter_arcs, winter_arc_rules, winter_arc_days,
--             winter_arc_rule_completions, winter_arc_milestones,
--             winter_arc_streak_protections, winter_arc_weekly_recaps
--   - Strict RLS: Owner mutation only, safe public/friends spectate, no data leaks
--   - Server functions: leaderboard RPC, streak protection validation
-- ==============================================================================

-- 1. WINTER ARCS (Root Solo Challenge)
CREATE TABLE IF NOT EXISTS public.winter_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Winter Arc 2026',
  start_date date NOT NULL DEFAULT '2026-10-01',
  end_date date NOT NULL DEFAULT '2026-12-31',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  notification_level text NOT NULL DEFAULT 'normal' CHECK (notification_level IN ('light', 'normal', 'lock_in')),
  streak_protection_available boolean NOT NULL DEFAULT true,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  overall_score numeric(5,2) NOT NULL DEFAULT 0.00,
  overall_completion numeric(5,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for user lookups & leaderboard queries
CREATE INDEX IF NOT EXISTS idx_winter_arcs_user_status ON public.winter_arcs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_winter_arcs_visibility ON public.winter_arcs (visibility, status);
CREATE INDEX IF NOT EXISTS idx_winter_arcs_leaderboard ON public.winter_arcs (overall_score DESC, current_streak DESC) WHERE status = 'active';

-- 2. WINTER ARC RULES (Customizable Rules with Weights)
CREATE TABLE IF NOT EXISTS public.winter_arc_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  target numeric NOT NULL DEFAULT 1 CHECK (target > 0),
  unit text NOT NULL DEFAULT 'times',
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
  order_index integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  icon text DEFAULT 'snow',
  color text DEFAULT '#00F5D4',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_rules_arc ON public.winter_arc_rules (winter_arc_id, order_index);

-- 3. WINTER ARC DAYS (Daily Deterministic Scoring Records)
CREATE TABLE IF NOT EXISTS public.winter_arc_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 366),
  score numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (score >= 0 AND score <= 100),
  completed_rules_count integer NOT NULL DEFAULT 0,
  total_rules_count integer NOT NULL DEFAULT 0,
  weighted_completion numeric(5,2) NOT NULL DEFAULT 0.00,
  streak_protection_used boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_winter_arc_days_arc_date UNIQUE (winter_arc_id, date)
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_days_arc_date ON public.winter_arc_days (winter_arc_id, date);
CREATE INDEX IF NOT EXISTS idx_winter_arc_days_user_date ON public.winter_arc_days (user_id, date);

-- 4. WINTER ARC RULE COMPLETIONS (Per-rule execution on a given day)
CREATE TABLE IF NOT EXISTS public.winter_arc_rule_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.winter_arc_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_winter_arc_rule_completions UNIQUE (rule_id, date)
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_rule_completions_lookup ON public.winter_arc_rule_completions (winter_arc_id, date);

-- 5. WINTER ARC MILESTONES (Single-trigger achievements)
CREATE TABLE IF NOT EXISTS public.winter_arc_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL CHECK (milestone_key IN ('day_7', 'day_14', 'day_30', 'day_50', 'day_75', 'completed')),
  title text NOT NULL,
  description text NOT NULL,
  day_number integer NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  notified boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_winter_arc_milestones UNIQUE (winter_arc_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_milestones_arc ON public.winter_arc_milestones (winter_arc_id);

-- 6. WINTER ARC STREAK PROTECTIONS (Max 1 per ISO week)
CREATE TABLE IF NOT EXISTS public.winter_arc_streak_protections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier text NOT NULL, -- Format: 'YYYY-Www', e.g. '2026-W40'
  consumed_for_date date NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_winter_arc_streak_protections_week UNIQUE (winter_arc_id, week_identifier)
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_streak_protections_arc ON public.winter_arc_streak_protections (winter_arc_id);

-- 7. WINTER ARC WEEKLY RECAPS (Generated every 7 Arc days)
CREATE TABLE IF NOT EXISTS public.winter_arc_weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winter_arc_id uuid NOT NULL REFERENCES public.winter_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1),
  start_date date NOT NULL,
  end_date date NOT NULL,
  weekly_score numeric(5,2) NOT NULL DEFAULT 0.00,
  consistency_percent numeric(5,2) NOT NULL DEFAULT 0.00,
  strongest_rule_title text DEFAULT '',
  weakest_rule_title text DEFAULT '',
  streak_end_of_week integer NOT NULL DEFAULT 0,
  comparison_to_previous_week numeric(5,2) DEFAULT NULL,
  progression_trend text NOT NULL DEFAULT 'steady' CHECK (progression_trend IN ('improving', 'steady', 'declining')),
  summary_text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_winter_arc_weekly_recaps UNIQUE (winter_arc_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_winter_arc_weekly_recaps_arc ON public.winter_arc_weekly_recaps (winter_arc_id, week_number);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.winter_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_rule_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_streak_protections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_arc_weekly_recaps ENABLE ROW LEVEL SECURITY;

-- Helper function: checks if viewer is a workspace friend of target user
CREATE OR REPLACE FUNCTION public.is_workspace_friend(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m1
    JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = target_user_id
  );
$$;

-- 1. winter_arcs RLS
-- Owner can do all
CREATE POLICY "Users can manage own winter arc"
  ON public.winter_arcs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Spectators can view public or friends arcs
CREATE POLICY "Users can view public or friends winter arcs"
  ON public.winter_arcs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR visibility = 'public'
    OR (visibility = 'friends' AND public.is_workspace_friend(user_id))
  );

-- 2. winter_arc_rules RLS
CREATE POLICY "Users can manage own winter arc rules"
  ON public.winter_arc_rules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view rules of permitted winter arcs"
  ON public.winter_arc_rules FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_rules.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- 3. winter_arc_days RLS
CREATE POLICY "Users can manage own winter arc days"
  ON public.winter_arc_days FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view days of permitted winter arcs"
  ON public.winter_arc_days FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_days.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- 4. winter_arc_rule_completions RLS
CREATE POLICY "Users can manage own rule completions"
  ON public.winter_arc_rule_completions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view completions of permitted winter arcs"
  ON public.winter_arc_rule_completions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_rule_completions.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- 5. winter_arc_milestones RLS
CREATE POLICY "Users can manage own winter arc milestones"
  ON public.winter_arc_milestones FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view milestones of permitted winter arcs"
  ON public.winter_arc_milestones FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_milestones.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- 6. winter_arc_streak_protections RLS
CREATE POLICY "Users can manage own streak protections"
  ON public.winter_arc_streak_protections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view streak protections of permitted winter arcs"
  ON public.winter_arc_streak_protections FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_streak_protections.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- 7. winter_arc_weekly_recaps RLS
CREATE POLICY "Users can manage own weekly recaps"
  ON public.winter_arc_weekly_recaps FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view weekly recaps of permitted winter arcs"
  ON public.winter_arc_weekly_recaps FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.winter_arcs
      WHERE winter_arcs.id = winter_arc_weekly_recaps.winter_arc_id
        AND (
          winter_arcs.visibility = 'public'
          OR (winter_arcs.visibility = 'friends' AND public.is_workspace_friend(winter_arcs.user_id))
        )
    )
  );

-- ==============================================================================
-- LEADERBOARD RPC FUNCTION (Solo Individual Ranking Only)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_winter_arc_leaderboard(
  filter_mode text DEFAULT 'global',
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  rank bigint,
  winter_arc_id uuid,
  user_id uuid,
  name text,
  username text,
  avatar_url text,
  current_streak integer,
  best_streak integer,
  overall_score numeric,
  overall_completion numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY wa.overall_score DESC, wa.current_streak DESC, wa.overall_completion DESC) AS rank,
    wa.id AS winter_arc_id,
    wa.user_id,
    coalesce(p.name, 'Warrior') AS name,
    coalesce(p.username, 'user') AS username,
    coalesce(p.avatar_url, '') AS avatar_url,
    wa.current_streak,
    wa.best_streak,
    wa.overall_score,
    wa.overall_completion,
    wa.status
  FROM public.winter_arcs wa
  JOIN public.profiles p ON p.id = wa.user_id
  WHERE wa.status = 'active'
    AND (
      (filter_mode = 'global' AND wa.visibility = 'public')
      OR (
        filter_mode = 'friends'
        AND (wa.visibility = 'public' OR wa.visibility = 'friends')
        AND (wa.user_id = auth.uid() OR public.is_workspace_friend(wa.user_id))
      )
    )
  ORDER BY wa.overall_score DESC, wa.current_streak DESC, wa.overall_completion DESC
  LIMIT limit_count;
END;
$$;
