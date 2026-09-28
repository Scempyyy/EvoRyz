import { supabase } from '@/utils/supabase';
import {
  WinterArc,
  WinterArcRule,
  WinterArcDay,
  WinterArcRuleCompletion,
  WinterArcMilestone,
  WinterArcStreakProtection,
  WinterArcWeeklyRecap,
  WinterArcLeaderboardEntry,
  SpectateWinterArcData,
  WinterArcSetupConfig,
} from '@/src/types/winterArc';
import { isUUID, generateUUID } from '@/src/utils/uuid';

export class WinterArcRepository {
  /**
   * Loads the current active Winter Arc and its configured rules for a user.
   */
  async getActiveWinterArc(userId: string): Promise<{ arc: WinterArc; rules: WinterArcRule[] } | null> {
    if (!isUUID(userId)) return null;

    try {
      const { data: arcData, error: arcErr } = await supabase
        .from('winter_arcs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (arcErr) {
        console.warn('[WinterArcRepository] getActiveWinterArc error:', arcErr.message);
        return null;
      }
      if (!arcData) return null;

      const arc: WinterArc = {
        id: arcData.id,
        userId: arcData.user_id,
        title: arcData.title,
        startDate: arcData.start_date,
        endDate: arcData.end_date,
        status: arcData.status,
        visibility: arcData.visibility,
        notificationLevel: arcData.notification_level,
        streakProtectionAvailable: arcData.streak_protection_available,
        currentStreak: arcData.current_streak,
        bestStreak: arcData.best_streak,
        overallScore: Number(arcData.overall_score || 0),
        overallCompletion: Number(arcData.overall_completion || 0),
        createdAt: arcData.created_at,
        updatedAt: arcData.updated_at,
      };

      const { data: rulesData, error: rulesErr } = await supabase
        .from('winter_arc_rules')
        .select('*')
        .eq('winter_arc_id', arc.id)
        .order('order_index', { ascending: true });

      if (rulesErr) {
        console.warn('[WinterArcRepository] getActiveWinterArc rules error:', rulesErr.message);
      }

      const rules: WinterArcRule[] = (rulesData || []).map((r) => ({
        id: r.id,
        winterArcId: r.winter_arc_id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        target: Number(r.target || 1),
        unit: r.unit || 'times',
        weight: Number(r.weight || 1),
        orderIndex: r.order_index,
        enabled: r.enabled,
        icon: r.icon,
        color: r.color,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return { arc, rules };
    } catch (err) {
      console.warn('[WinterArcRepository] getActiveWinterArc exception:', err);
      return null;
    }
  }

  /**
   * Initializes a brand new solo Winter Arc with custom rules.
   */
  async createWinterArc(
    userId: string,
    setup: WinterArcSetupConfig
  ): Promise<{ arc: WinterArc; rules: WinterArcRule[] }> {
    const arcId = generateUUID();
    const now = new Date().toISOString();

    const insertArcPayload = {
      id: arcId,
      user_id: userId,
      title: setup.title || 'Winter Arc 2026',
      start_date: setup.startDate,
      end_date: setup.endDate,
      status: 'active',
      visibility: setup.visibility || 'public',
      notification_level: setup.notificationLevel || 'normal',
      streak_protection_available: true,
      current_streak: 0,
      best_streak: 0,
      overall_score: 0.0,
      overall_completion: 0.0,
      created_at: now,
      updated_at: now,
    };

    const { error: arcErr } = await supabase.from('winter_arcs').insert(insertArcPayload);
    if (arcErr) {
      throw new Error(`Failed to create Winter Arc: ${arcErr.message}`);
    }

    const createdRules: WinterArcRule[] = [];
    const insertRulesPayload = setup.rules.map((r, idx) => {
      const ruleId = generateUUID();
      const rule: WinterArcRule = {
        id: ruleId,
        winterArcId: arcId,
        userId,
        title: r.title,
        description: r.description || '',
        target: r.target,
        unit: r.unit,
        weight: r.weight,
        orderIndex: idx,
        enabled: r.enabled !== false,
        icon: r.icon || 'snow',
        color: r.color || '#00F5D4',
        createdAt: now,
        updatedAt: now,
      };
      createdRules.push(rule);
      return {
        id: rule.id,
        winter_arc_id: arcId,
        user_id: userId,
        title: rule.title,
        description: rule.description,
        target: rule.target,
        unit: rule.unit,
        weight: rule.weight,
        order_index: rule.orderIndex,
        enabled: rule.enabled,
        icon: rule.icon,
        color: rule.color,
        created_at: now,
        updated_at: now,
      };
    });

    if (insertRulesPayload.length > 0) {
      const { error: rErr } = await supabase.from('winter_arc_rules').insert(insertRulesPayload);
      if (rErr) {
        console.warn('[WinterArcRepository] createWinterArc rules insert error:', rErr.message);
      }
    }

    const arc: WinterArc = {
      id: arcId,
      userId,
      title: insertArcPayload.title,
      startDate: insertArcPayload.start_date,
      endDate: insertArcPayload.end_date,
      status: 'active',
      visibility: insertArcPayload.visibility as any,
      notificationLevel: insertArcPayload.notification_level as any,
      streakProtectionAvailable: true,
      currentStreak: 0,
      bestStreak: 0,
      overallScore: 0,
      overallCompletion: 0,
      createdAt: now,
      updatedAt: now,
    };

    return { arc, rules: createdRules };
  }

  /**
   * Updates Arc attributes like streaks, score, status, or settings.
   */
  async updateWinterArc(arcId: string, updates: Partial<WinterArc>): Promise<boolean> {
    if (!isUUID(arcId)) return false;
    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.visibility !== undefined) payload.visibility = updates.visibility;
      if (updates.notificationLevel !== undefined) payload.notification_level = updates.notificationLevel;
      if (updates.streakProtectionAvailable !== undefined) payload.streak_protection_available = updates.streakProtectionAvailable;
      if (updates.currentStreak !== undefined) payload.current_streak = updates.currentStreak;
      if (updates.bestStreak !== undefined) payload.best_streak = updates.bestStreak;
      if (updates.overallScore !== undefined) payload.overall_score = updates.overallScore;
      if (updates.overallCompletion !== undefined) payload.overall_completion = updates.overallCompletion;

      const { error } = await supabase.from('winter_arcs').update(payload).eq('id', arcId);
      if (error) {
        console.warn('[WinterArcRepository] updateWinterArc error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] updateWinterArc exception:', err);
      return false;
    }
  }

  /**
   * Records or updates a rule completion for a specific date.
   */
  async recordRuleCompletion(params: {
    winterArcId: string;
    ruleId: string;
    userId: string;
    date: string;
    value: number;
    completed: boolean;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('winter_arc_rule_completions').upsert(
        {
          winter_arc_id: params.winterArcId,
          rule_id: params.ruleId,
          user_id: params.userId,
          date: params.date,
          value: params.value,
          completed: params.completed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'rule_id,date' }
      );
      if (error) {
        console.warn('[WinterArcRepository] recordRuleCompletion error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] recordRuleCompletion exception:', err);
      return false;
    }
  }

  /**
   * Saves or updates a daily score record.
   */
  async saveDailyScore(params: {
    winterArcId: string;
    userId: string;
    date: string;
    dayNumber: number;
    score: number;
    completedRulesCount: number;
    totalRulesCount: number;
    weightedCompletion: number;
    streakProtectionUsed: boolean;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('winter_arc_days').upsert(
        {
          winter_arc_id: params.winterArcId,
          user_id: params.userId,
          date: params.date,
          day_number: params.dayNumber,
          score: params.score,
          completed_rules_count: params.completedRulesCount,
          total_rules_count: params.totalRulesCount,
          weighted_completion: params.weightedCompletion,
          streak_protection_used: params.streakProtectionUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'winter_arc_id,date' }
      );
      if (error) {
        console.warn('[WinterArcRepository] saveDailyScore error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] saveDailyScore exception:', err);
      return false;
    }
  }

  /**
   * Fetches all recorded days for a Winter Arc.
   */
  async getDaysHistory(winterArcId: string): Promise<WinterArcDay[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_days')
        .select('*')
        .eq('winter_arc_id', winterArcId)
        .order('date', { ascending: true });

      if (error) {
        console.warn('[WinterArcRepository] getDaysHistory error:', error.message);
        return [];
      }

      return (data || []).map((d) => ({
        id: d.id,
        winterArcId: d.winter_arc_id,
        userId: d.user_id,
        date: d.date,
        dayNumber: d.day_number,
        score: Number(d.score || 0),
        completedRulesCount: d.completed_rules_count,
        totalRulesCount: d.total_rules_count,
        weightedCompletion: Number(d.weighted_completion || 0),
        streakProtectionUsed: d.streak_protection_used,
        notes: d.notes,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getDaysHistory exception:', err);
      return [];
    }
  }

  /**
   * Fetches rule completions for a specific date.
   */
  async getCompletionsForDate(winterArcId: string, date: string): Promise<WinterArcRuleCompletion[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_rule_completions')
        .select('*')
        .eq('winter_arc_id', winterArcId)
        .eq('date', date);

      if (error) {
        console.warn('[WinterArcRepository] getCompletionsForDate error:', error.message);
        return [];
      }

      return (data || []).map((c) => ({
        id: c.id,
        winterArcId: c.winter_arc_id,
        ruleId: c.rule_id,
        userId: c.user_id,
        date: c.date,
        value: Number(c.value || 0),
        completed: c.completed,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getCompletionsForDate exception:', err);
      return [];
    }
  }

  /**
   * Fetches all rule completions for the arc.
   */
  async getAllCompletions(winterArcId: string): Promise<WinterArcRuleCompletion[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_rule_completions')
        .select('*')
        .eq('winter_arc_id', winterArcId);

      if (error) {
        console.warn('[WinterArcRepository] getAllCompletions error:', error.message);
        return [];
      }

      return (data || []).map((c) => ({
        id: c.id,
        winterArcId: c.winter_arc_id,
        ruleId: c.rule_id,
        userId: c.user_id,
        date: c.date,
        value: Number(c.value || 0),
        completed: c.completed,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getAllCompletions exception:', err);
      return [];
    }
  }

  /**
   * Fetches all recorded milestones for an arc.
   */
  async getMilestones(winterArcId: string): Promise<WinterArcMilestone[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_milestones')
        .select('*')
        .eq('winter_arc_id', winterArcId)
        .order('day_number', { ascending: true });

      if (error) {
        console.warn('[WinterArcRepository] getMilestones error:', error.message);
        return [];
      }

      return (data || []).map((m) => ({
        id: m.id,
        winterArcId: m.winter_arc_id,
        userId: m.user_id,
        milestoneKey: m.milestone_key,
        title: m.title,
        description: m.description,
        dayNumber: m.day_number,
        achievedAt: m.achieved_at,
        notified: m.notified,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getMilestones exception:', err);
      return [];
    }
  }

  /**
   * Saves newly unlocked milestones.
   */
  async saveMilestones(milestones: WinterArcMilestone[]): Promise<boolean> {
    if (milestones.length === 0) return true;
    try {
      const payload = milestones.map((m) => ({
        winter_arc_id: m.winterArcId,
        user_id: m.userId,
        milestone_key: m.milestoneKey,
        title: m.title,
        description: m.description,
        day_number: m.dayNumber,
        achieved_at: m.achievedAt,
        notified: m.notified,
      }));

      const { error } = await supabase.from('winter_arc_milestones').upsert(payload, {
        onConflict: 'winter_arc_id,milestone_key',
      });
      if (error) {
        console.warn('[WinterArcRepository] saveMilestones error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] saveMilestones exception:', err);
      return false;
    }
  }

  /**
   * Fetches streak protections consumed by this arc.
   */
  async getStreakProtections(winterArcId: string): Promise<WinterArcStreakProtection[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_streak_protections')
        .select('*')
        .eq('winter_arc_id', winterArcId);

      if (error) {
        console.warn('[WinterArcRepository] getStreakProtections error:', error.message);
        return [];
      }

      return (data || []).map((p) => ({
        id: p.id,
        winterArcId: p.winter_arc_id,
        userId: p.user_id,
        weekIdentifier: p.week_identifier,
        consumedForDate: p.consumed_for_date,
        consumedAt: p.consumed_at,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getStreakProtections exception:', err);
      return [];
    }
  }

  /**
   * Records streak protection consumption for a week.
   */
  async consumeStreakProtection(params: {
    winterArcId: string;
    userId: string;
    weekIdentifier: string;
    consumedForDate: string;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('winter_arc_streak_protections').insert({
        winter_arc_id: params.winterArcId,
        user_id: params.userId,
        week_identifier: params.weekIdentifier,
        consumed_for_date: params.consumedForDate,
      });

      if (error) {
        console.warn('[WinterArcRepository] consumeStreakProtection error:', error.message);
        return false;
      }

      await supabase
        .from('winter_arcs')
        .update({ streak_protection_available: false, updated_at: new Date().toISOString() })
        .eq('id', params.winterArcId);

      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] consumeStreakProtection exception:', err);
      return false;
    }
  }

  /**
   * Fetches weekly recaps.
   */
  async getWeeklyRecaps(winterArcId: string): Promise<WinterArcWeeklyRecap[]> {
    if (!isUUID(winterArcId)) return [];
    try {
      const { data, error } = await supabase
        .from('winter_arc_weekly_recaps')
        .select('*')
        .eq('winter_arc_id', winterArcId)
        .order('week_number', { ascending: true });

      if (error) {
        console.warn('[WinterArcRepository] getWeeklyRecaps error:', error.message);
        return [];
      }

      return (data || []).map((r) => ({
        id: r.id,
        winterArcId: r.winter_arc_id,
        userId: r.user_id,
        weekNumber: r.week_number,
        startDate: r.start_date,
        endDate: r.end_date,
        weeklyScore: Number(r.weekly_score || 0),
        consistencyPercent: Number(r.consistency_percent || 0),
        strongestRuleTitle: r.strongest_rule_title || '',
        weakestRuleTitle: r.weakest_rule_title || '',
        streakEndOfWeek: r.streak_end_of_week || 0,
        comparisonToPreviousWeek: r.comparison_to_previous_week !== null ? Number(r.comparison_to_previous_week) : null,
        progressionTrend: r.progression_trend,
        summaryText: r.summary_text || '',
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getWeeklyRecaps exception:', err);
      return [];
    }
  }

  /**
   * Saves a weekly recap record.
   */
  async saveWeeklyRecap(recap: WinterArcWeeklyRecap): Promise<boolean> {
    try {
      const { error } = await supabase.from('winter_arc_weekly_recaps').upsert(
        {
          winter_arc_id: recap.winterArcId,
          user_id: recap.userId,
          week_number: recap.weekNumber,
          start_date: recap.startDate,
          end_date: recap.endDate,
          weekly_score: recap.weeklyScore,
          consistency_percent: recap.consistencyPercent,
          strongest_rule_title: recap.strongestRuleTitle,
          weakest_rule_title: recap.weakestRuleTitle,
          streak_end_of_week: recap.streakEndOfWeek,
          comparison_to_previous_week: recap.comparisonToPreviousWeek,
          progression_trend: recap.progressionTrend,
          summary_text: recap.summaryText,
        },
        { onConflict: 'winter_arc_id,week_number' }
      );

      if (error) {
        console.warn('[WinterArcRepository] saveWeeklyRecap error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[WinterArcRepository] saveWeeklyRecap exception:', err);
      return false;
    }
  }

  /**
   * Queries the authoritative Solo Leaderboard (Global or Friends).
   * Never fabricates fake global users.
   */
  async getLeaderboard(
    filterMode: 'global' | 'friends' = 'global',
    limit = 50
  ): Promise<WinterArcLeaderboardEntry[]> {
    try {
      const { data, error } = await supabase.rpc('get_winter_arc_leaderboard', {
        filter_mode: filterMode,
        limit_count: limit,
      });

      if (error) {
        console.warn('[WinterArcRepository] getLeaderboard RPC error, falling back to direct query:', error.message);
        // Direct query fallback
        let query = supabase
          .from('winter_arcs')
          .select('id, user_id, current_streak, best_streak, overall_score, overall_completion, status')
          .eq('status', 'active')
          .order('overall_score', { ascending: false })
          .limit(limit);

        if (filterMode === 'global') {
          query = query.eq('visibility', 'public');
        }

        const { data: directData, error: directErr } = await query;
        if (directErr || !directData) return [];

        const userIds = directData.map((d) => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        return directData.map((d, index) => {
          const prof = profileMap.get(d.user_id);
          return {
            rank: index + 1,
            winterArcId: d.id,
            userId: d.user_id,
            name: prof?.name || 'Warrior',
            username: prof?.username || 'user',
            avatarUrl: prof?.avatar_url || '',
            currentStreak: d.current_streak,
            bestStreak: d.best_streak,
            overallScore: Number(d.overall_score || 0),
            overallCompletion: Number(d.overall_completion || 0),
            status: d.status,
          };
        });
      }

      return (data || []).map((row: any) => ({
        rank: Number(row.rank),
        winterArcId: row.winter_arc_id,
        userId: row.user_id,
        name: row.name || 'Warrior',
        username: row.username || 'user',
        avatarUrl: row.avatar_url || '',
        currentStreak: row.current_streak || 0,
        bestStreak: row.best_streak || 0,
        overallScore: Number(row.overall_score || 0),
        overallCompletion: Number(row.overall_completion || 0),
        status: row.status,
      }));
    } catch (err) {
      console.warn('[WinterArcRepository] getLeaderboard exception:', err);
      return [];
    }
  }

  /**
   * Fetches public/friends Winter Arc spectate data for another participant.
   * Never exposes private EvoRyz tasks, habits, meals, journal, or workspace chat.
   */
  async getSpectateData(targetUserId: string): Promise<SpectateWinterArcData | null> {
    if (!isUUID(targetUserId)) return null;

    try {
      const { data: arcData, error: arcErr } = await supabase
        .from('winter_arcs')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .maybeSingle();

      if (arcErr || !arcData) {
        return null;
      }

      // Check visibility permissions
      if (arcData.visibility === 'private') {
        return null;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, username, avatar_url')
        .eq('id', targetUserId)
        .maybeSingle();

      const { data: rulesData } = await supabase
        .from('winter_arc_rules')
        .select('*')
        .eq('winter_arc_id', arcData.id)
        .order('order_index', { ascending: true });

      const { data: daysData } = await supabase
        .from('winter_arc_days')
        .select('*')
        .eq('winter_arc_id', arcData.id)
        .order('date', { ascending: true });

      const { data: milestonesData } = await supabase
        .from('winter_arc_milestones')
        .select('*')
        .eq('winter_arc_id', arcData.id)
        .order('day_number', { ascending: true });

      const winterArc: WinterArc = {
        id: arcData.id,
        userId: arcData.user_id,
        title: arcData.title,
        startDate: arcData.start_date,
        endDate: arcData.end_date,
        status: arcData.status,
        visibility: arcData.visibility,
        notificationLevel: arcData.notification_level,
        streakProtectionAvailable: arcData.streak_protection_available,
        currentStreak: arcData.current_streak,
        bestStreak: arcData.best_streak,
        overallScore: Number(arcData.overall_score || 0),
        overallCompletion: Number(arcData.overall_completion || 0),
        createdAt: arcData.created_at,
        updatedAt: arcData.updated_at,
      };

      const rules: WinterArcRule[] = (rulesData || []).map((r) => ({
        id: r.id,
        winterArcId: r.winter_arc_id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        target: Number(r.target || 1),
        unit: r.unit || 'times',
        weight: Number(r.weight || 1),
        orderIndex: r.order_index,
        enabled: r.enabled,
        icon: r.icon,
        color: r.color,
      }));

      const days: WinterArcDay[] = (daysData || []).map((d) => ({
        id: d.id,
        winterArcId: d.winter_arc_id,
        userId: d.user_id,
        date: d.date,
        dayNumber: d.day_number,
        score: Number(d.score || 0),
        completedRulesCount: d.completed_rules_count,
        totalRulesCount: d.total_rules_count,
        weightedCompletion: Number(d.weighted_completion || 0),
        streakProtectionUsed: d.streak_protection_used,
        notes: d.notes,
      }));

      const milestones: WinterArcMilestone[] = (milestonesData || []).map((m) => ({
        id: m.id,
        winterArcId: m.winter_arc_id,
        userId: m.user_id,
        milestoneKey: m.milestone_key,
        title: m.title,
        description: m.description,
        dayNumber: m.day_number,
        achievedAt: m.achieved_at,
        notified: m.notified,
      }));

      return {
        winterArc,
        rules,
        days,
        milestones,
        ownerProfile: {
          name: profileData?.name || 'Warrior',
          username: profileData?.username || 'user',
          avatarUrl: profileData?.avatar_url || '',
        },
      };
    } catch (err) {
      console.warn('[WinterArcRepository] getSpectateData exception:', err);
      return null;
    }
  }
}

export const winterArcRepo = new WinterArcRepository();
