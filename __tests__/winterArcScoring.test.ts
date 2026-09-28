import {
  calculateDailyScore,
  evaluateStreaksAndProtection,
  calculateOverallProgress,
  getIsoWeekIdentifier,
  PASSING_SCORE_THRESHOLD,
} from '@/src/services/winterArcScoring';
import { WinterArcRule, WinterArcRuleCompletion, WinterArcDay } from '@/src/types/winterArc';

describe('Winter Arc v1 Scoring Engine', () => {
  const mockRules: WinterArcRule[] = [
    {
      id: 'rule-1',
      winterArcId: 'arc-1',
      userId: 'user-1',
      title: 'Wake up at 05:30',
      description: 'Discipline begins at dawn',
      target: 1,
      unit: 'check',
      weight: 3, // Weight 3
      enabled: true,
      orderIndex: 0,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'rule-2',
      winterArcId: 'arc-1',
      userId: 'user-1',
      title: 'Workout 60 mins',
      description: 'Physical training',
      target: 60,
      unit: 'mins',
      weight: 5, // Weight 5
      enabled: true,
      orderIndex: 1,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'rule-3',
      winterArcId: 'arc-1',
      userId: 'user-1',
      title: 'Read 20 pages',
      description: 'Knowledge accumulation',
      target: 20,
      unit: 'pages',
      weight: 2, // Weight 2
      enabled: true,
      orderIndex: 2,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'rule-4-disabled',
      winterArcId: 'arc-1',
      userId: 'user-1',
      title: 'Disabled Habit',
      description: 'Not active',
      target: 10,
      unit: 'times',
      weight: 10,
      enabled: false,
      orderIndex: 3,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  describe('calculateDailyScore', () => {
    it('returns score 0 when no rules are enabled', () => {
      const result = calculateDailyScore([], [], '2026-10-01', 1);
      expect(result.score).toBe(0);
      expect(result.totalRulesCount).toBe(0);
      expect(result.completedRulesCount).toBe(0);
      expect(result.isPassing).toBe(false);
    });

    it('calculates 100% score when all enabled rules are fully completed', () => {
      const completions: WinterArcRuleCompletion[] = [
        {
          id: 'c1',
          dayId: 'd1',
          ruleId: 'rule-1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 1,
          notes: null,
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'c2',
          dayId: 'd1',
          ruleId: 'rule-2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 60,
          notes: null,
          updatedAt: '2026-10-01T11:00:00Z',
        },
        {
          id: 'c3',
          dayId: 'd1',
          ruleId: 'rule-3',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 20,
          notes: null,
          updatedAt: '2026-10-01T12:00:00Z',
        },
      ];

      const result = calculateDailyScore(mockRules, completions, '2026-10-01', 1);
      expect(result.score).toBe(100);
      expect(result.completedRulesCount).toBe(3);
      expect(result.totalRulesCount).toBe(3); // ignores rule-4-disabled
      expect(result.isPassing).toBe(true);
    });

    it('calculates weighted score accurately with partial completions', () => {
      // Total enabled weight = 3 + 5 + 2 = 10
      // rule-1 completed -> 3 weight
      // rule-2: 30 / 60 mins -> 0.5 * 5 = 2.5 weight
      // rule-3: 0 pages -> 0 weight
      // Total earned = 3 + 2.5 = 5.5 / 10 = 55%
      const completions: WinterArcRuleCompletion[] = [
        {
          id: 'c1',
          dayId: 'd1',
          ruleId: 'rule-1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 1,
          notes: null,
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'c2',
          dayId: 'd1',
          ruleId: 'rule-2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: false,
          value: 30, // half of 60
          notes: null,
          updatedAt: '2026-10-01T11:00:00Z',
        },
      ];

      const result = calculateDailyScore(mockRules, completions, '2026-10-01', 1);
      expect(result.score).toBe(55);
      expect(result.completedRulesCount).toBe(1);
      expect(result.isPassing).toBe(false); // 55 < 70
    });

    it('considers score passing when exactly at or above threshold', () => {
      // rule-2 (5 weight) + rule-3 (2 weight) = 7 weight / 10 = 70%
      const completions: WinterArcRuleCompletion[] = [
        {
          id: 'c2',
          dayId: 'd1',
          ruleId: 'rule-2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 60,
          notes: null,
          updatedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'c3',
          dayId: 'd1',
          ruleId: 'rule-3',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          completed: true,
          value: 20,
          notes: null,
          updatedAt: '2026-10-01T11:00:00Z',
        },
      ];

      const result = calculateDailyScore(mockRules, completions, '2026-10-01', 1);
      expect(result.score).toBe(70);
      expect(result.isPassing).toBe(true);
      expect(PASSING_SCORE_THRESHOLD).toBe(70.0);
    });
  });

  describe('evaluateStreaksAndProtection', () => {
    it('builds streak on consecutive passing days', () => {
      const days: WinterArcDay[] = [
        {
          id: 'd1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          dayNumber: 1,
          score: 85,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'd2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-02',
          dayNumber: 2,
          score: 90,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
        {
          id: 'd3',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-03',
          dayNumber: 3,
          score: 75,
          completedRulesCount: 2,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
      ];

      const res = evaluateStreaksAndProtection(days, '2026-10-03');
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
      expect(res.streakProtectionAvailable).toBe(true);
      expect(res.streakProtectionUsedToday).toBe(false);
    });

    it('auto-consumes 1 streak protection per ISO week on a missed day', () => {
      // 2026-10-01 (Thu), 2026-10-02 (Fri), 2026-10-03 (Sat) are in same ISO week (2026-W40)
      const days: WinterArcDay[] = [
        {
          id: 'd1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          dayNumber: 1,
          score: 80,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'd2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-02',
          dayNumber: 2,
          score: 40, // MISSED DAY (< 70)
          completedRulesCount: 1,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
        {
          id: 'd3',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-03',
          dayNumber: 3,
          score: 85,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
      ];

      const res = evaluateStreaksAndProtection(days, '2026-10-03');
      // d2 was protected, so streak continues to 3!
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
      expect(res.daysWithProtection).toContain('2026-10-02');
      // For week 40, protection was consumed, so available is now false
      expect(res.streakProtectionAvailable).toBe(false);
    });

    it('does not stack protection and breaks streak on second missed day in the same week', () => {
      // d2 missed -> protected. d3 missed in SAME week -> no protection available -> streak resets!
      const days: WinterArcDay[] = [
        {
          id: 'd1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          dayNumber: 1,
          score: 80,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'd2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-02',
          dayNumber: 2,
          score: 40, // 1st Missed -> consumes protection
          completedRulesCount: 1,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
        {
          id: 'd3',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-03',
          dayNumber: 3,
          score: 30, // 2nd Missed in SAME week -> streak broken!
          completedRulesCount: 1,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
      ];

      const res = evaluateStreaksAndProtection(days, '2026-10-03');
      expect(res.currentStreak).toBe(0);
      expect(res.bestStreak).toBe(2); // d1 + d2 protected
      expect(res.streakProtectionAvailable).toBe(false);
    });

    it('ignores future days beyond todayStr', () => {
      const days: WinterArcDay[] = [
        {
          id: 'd1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          dayNumber: 1,
          score: 80,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'd2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-02',
          dayNumber: 2,
          score: 20, // Future day
          completedRulesCount: 0,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
      ];

      // todayStr is 2026-10-01, so d2 is ignored
      const res = evaluateStreaksAndProtection(days, '2026-10-01');
      expect(res.currentStreak).toBe(1);
    });
  });

  describe('calculateOverallProgress', () => {
    it('returns zeroes for empty days', () => {
      const progress = calculateOverallProgress([], 92);
      expect(progress.overallScore).toBe(0);
      expect(progress.overallCompletion).toBe(0);
      expect(progress.completedDaysCount).toBe(0);
    });

    it('calculates average score and completion percentage for 92-day Arc', () => {
      const days: WinterArcDay[] = [
        {
          id: 'd1',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-01',
          dayNumber: 1,
          score: 80,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'd2',
          winterArcId: 'arc-1',
          userId: 'user-1',
          date: '2026-10-02',
          dayNumber: 2,
          score: 100,
          completedRulesCount: 3,
          totalRulesCount: 3,
          streakProtectionUsed: false,
          notes: null,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
      ];

      const progress = calculateOverallProgress(days, 92);
      // Average score = (80 + 100) / 2 = 90
      expect(progress.overallScore).toBe(90);
      expect(progress.completedDaysCount).toBe(2);
      // Overall completion = 2 / 92 * 100 = 2.17%
      expect(progress.overallCompletion).toBe(2.17);
    });
  });

  describe('getIsoWeekIdentifier', () => {
    it('formats ISO week as YYYY-Www', () => {
      const weekId = getIsoWeekIdentifier(new Date('2026-10-01T12:00:00Z'));
      expect(weekId).toMatch(/^2026-W\d{2}$/);
    });
  });
});
