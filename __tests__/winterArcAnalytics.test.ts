import {
  checkNewMilestones,
  generateWeeklyRecap,
  buildWinterArcAnalytics,
  WINTER_ARC_MILESTONES_DEF,
} from '@/src/services/winterArcAnalytics';
import {
  WinterArcMilestone,
  WinterArcDay,
  WinterArcRule,
  WinterArcRuleCompletion,
  WinterArcWeeklyRecap,
} from '@/src/types/winterArc';

describe('Winter Arc v1 Analytics & Milestones', () => {
  const userId = 'user-test-123';
  const winterArcId = 'arc-test-456';

  describe('checkNewMilestones', () => {
    it('defines all 6 canonical milestones (7, 14, 30, 50, 75, completed 92)', () => {
      const keys = WINTER_ARC_MILESTONES_DEF.map((m) => m.key);
      expect(keys).toEqual(['day_7', 'day_14', 'day_30', 'day_50', 'day_75', 'completed']);
    });

    it('returns empty array when dayNumber has not reached any milestone', () => {
      const milestones = checkNewMilestones(6, [], winterArcId, userId);
      expect(milestones).toHaveLength(0);
    });

    it('triggers day_7 milestone when dayNumber reaches 7', () => {
      const milestones = checkNewMilestones(7, [], winterArcId, userId);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].milestoneKey).toBe('day_7');
      expect(milestones[0].dayNumber).toBe(7);
      expect(milestones[0].winterArcId).toBe(winterArcId);
      expect(milestones[0].userId).toBe(userId);
    });

    it('triggers multiple milestones if jumping forward without duplicates', () => {
      const existing: WinterArcMilestone[] = [
        {
          id: 'm1',
          winterArcId,
          userId,
          milestoneKey: 'day_7',
          title: 'The First Week of Iron',
          description: 'Desc',
          dayNumber: 7,
          achievedAt: '2026-10-07T00:00:00Z',
          notified: true,
        },
      ];

      // Reached day 30, day_7 already exists -> should trigger day_14 and day_30
      const newMilestones = checkNewMilestones(30, existing, winterArcId, userId);
      expect(newMilestones).toHaveLength(2);
      expect(newMilestones.map((m) => m.milestoneKey)).toEqual(['day_14', 'day_30']);
    });

    it('never triggers already achieved milestones', () => {
      const allExisting: WinterArcMilestone[] = WINTER_ARC_MILESTONES_DEF.map((def) => ({
        id: `m-${def.key}`,
        winterArcId,
        userId,
        milestoneKey: def.key,
        title: def.title,
        description: def.description,
        dayNumber: def.dayNumber,
        achievedAt: '2026-12-31T00:00:00Z',
        notified: true,
      }));

      const newMilestones = checkNewMilestones(92, allExisting, winterArcId, userId);
      expect(newMilestones).toHaveLength(0);
    });

    it('dynamically adapts completion milestone and ignores intermediate milestones beyond custom duration', () => {
      // 60-day custom Winter Arc
      const customTotalDays = 60;
      const milestonesAtDay60 = checkNewMilestones(60, [], winterArcId, userId, customTotalDays);

      // Should include day_7, day_14, day_30, day_50, and completed (at day 60), but NOT day_75
      const keys = milestonesAtDay60.map((m) => m.milestoneKey);
      expect(keys).toContain('day_7');
      expect(keys).toContain('day_14');
      expect(keys).toContain('day_30');
      expect(keys).toContain('day_50');
      expect(keys).toContain('completed');
      expect(keys).not.toContain('day_75');

      const completedMilestone = milestonesAtDay60.find((m) => m.milestoneKey === 'completed');
      expect(completedMilestone?.dayNumber).toBe(60);
      expect(completedMilestone?.description).toContain('60 days');
    });
  });

  describe('generateWeeklyRecap', () => {
    const mockRules: WinterArcRule[] = [
      {
        id: 'r1',
        winterArcId,
        userId,
        title: 'Morning Cardio',
        description: '',
        target: 1,
        unit: 'session',
        weight: 5,
        enabled: true,
        orderIndex: 0,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 'r2',
        winterArcId,
        userId,
        title: 'Cold Shower',
        description: '',
        target: 1,
        unit: 'session',
        weight: 3,
        enabled: true,
        orderIndex: 1,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];

    it('returns null if daysInWeek is empty', () => {
      const recap = generateWeeklyRecap(1, [], mockRules, [], null, winterArcId, userId);
      expect(recap).toBeNull();
    });

    it('computes weekly score, consistency, strongest and weakest rule', () => {
      const daysInWeek: WinterArcDay[] = [
        { id: 'd1', winterArcId, userId, date: '2026-10-01', dayNumber: 1, score: 100, completedRulesCount: 2, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
        { id: 'd2', winterArcId, userId, date: '2026-10-02', dayNumber: 2, score: 80, completedRulesCount: 1, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
        { id: 'd3', winterArcId, userId, date: '2026-10-03', dayNumber: 3, score: 100, completedRulesCount: 2, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
        { id: 'd4', winterArcId, userId, date: '2026-10-04', dayNumber: 4, score: 50, completedRulesCount: 1, totalRulesCount: 2, streakProtectionUsed: true, notes: null, createdAt: '', updatedAt: '' }, // protected -> counts as passing
        { id: 'd5', winterArcId, userId, date: '2026-10-05', dayNumber: 5, score: 90, completedRulesCount: 2, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
        { id: 'd6', winterArcId, userId, date: '2026-10-06', dayNumber: 6, score: 70, completedRulesCount: 1, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
        { id: 'd7', winterArcId, userId, date: '2026-10-07', dayNumber: 7, score: 100, completedRulesCount: 2, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
      ];

      // Completions: r1 completed 7 times, r2 completed 4 times
      const completions: WinterArcRuleCompletion[] = [];
      for (const d of daysInWeek) {
        completions.push({ id: `c-r1-${d.date}`, dayId: d.id, ruleId: 'r1', winterArcId, userId, date: d.date, completed: true, value: 1, notes: null, updatedAt: '' });
      }
      for (const d of daysInWeek.slice(0, 4)) {
        completions.push({ id: `c-r2-${d.date}`, dayId: d.id, ruleId: 'r2', winterArcId, userId, date: d.date, completed: true, value: 1, notes: null, updatedAt: '' });
      }

      const recap = generateWeeklyRecap(1, daysInWeek, mockRules, completions, null, winterArcId, userId);
      expect(recap).not.toBeNull();
      // Average score = (100 + 80 + 100 + 50 + 90 + 70 + 100) / 7 = 590 / 7 = 84.29
      expect(recap!.weeklyScore).toBe(84.29);
      // All 7 days either >= 70 or protected (d4 had protection) -> 7/7 = 100%
      expect(recap!.consistencyPercent).toBe(100);
      expect(recap!.strongestRuleTitle).toBe('Morning Cardio');
      expect(recap!.weakestRuleTitle).toBe('Cold Shower');
      expect(recap!.progressionTrend).toBe('steady');
    });

    it('calculates progressionTrend against previous recap', () => {
      const prevRecap: WinterArcWeeklyRecap = {
        id: 'recap-1',
        winterArcId,
        userId,
        weekNumber: 1,
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        weeklyScore: 75,
        consistencyPercent: 85,
        strongestRuleTitle: 'R1',
        weakestRuleTitle: 'R2',
        streakEndOfWeek: 7,
        comparisonToPreviousWeek: null,
        progressionTrend: 'steady',
        summaryText: '',
        createdAt: '',
      };

      const daysWeek2: WinterArcDay[] = [
        { id: 'd8', winterArcId, userId, date: '2026-10-08', dayNumber: 8, score: 95, completedRulesCount: 2, totalRulesCount: 2, streakProtectionUsed: false, notes: null, createdAt: '', updatedAt: '' },
      ];

      const recapWeek2 = generateWeeklyRecap(2, daysWeek2, mockRules, [], prevRecap, winterArcId, userId);
      expect(recapWeek2!.weeklyScore).toBe(95);
      // Comparison = 95 - 75 = +20 -> 'improving'
      expect(recapWeek2!.comparisonToPreviousWeek).toBe(20);
      expect(recapWeek2!.progressionTrend).toBe('improving');
    });
  });

  describe('buildWinterArcAnalytics', () => {
    it('aggregates daily scores and weekly consistency chunks correctly', () => {
      const days: WinterArcDay[] = Array.from({ length: 14 }, (_, i) => ({
        id: `d-${i + 1}`,
        winterArcId,
        userId,
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        dayNumber: i + 1,
        score: i === 3 ? 40 : 80, // day 4 failed
        completedRulesCount: 2,
        totalRulesCount: 2,
        streakProtectionUsed: i === 3, // day 4 protected
        notes: null,
        createdAt: '',
        updatedAt: '',
      }));

      const analytics = buildWinterArcAnalytics(days, [], []);
      expect(analytics.dailyScores).toHaveLength(14);
      expect(analytics.weeklyConsistency).toHaveLength(2); // 14 days = 2 weeks of 7
      expect(analytics.totalEligibleDays).toBe(14);
      expect(analytics.daysProtected).toBe(1);
      expect(analytics.daysPassed).toBe(13);
      expect(analytics.daysMissed).toBe(0);
    });
  });
});
