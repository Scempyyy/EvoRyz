import {
  WINTER_ARC_START,
  WINTER_ARC_END,
  WINTER_ARC_TOTAL_DAYS,
  getWinterArcMonths,
  getWinterArcDayNumber,
  getDaysUntilWinterArc,
  isWinterArcDateLocked,
  calculateWinterArcStats,
  WinterArcHabit,
} from '@/src/services/winterArc';

describe('Winter Arc 2026 Core Logic', () => {
  it('has exact start, end, and 92 total days', () => {
    expect(WINTER_ARC_START).toBe('2026-10-01');
    expect(WINTER_ARC_END).toBe('2026-12-31');
    expect(WINTER_ARC_TOTAL_DAYS).toBe(92);
  });

  it('generates the 3 correct months with correct day counts', () => {
    const months = getWinterArcMonths();
    expect(months).toHaveLength(3);

    expect(months[0].name).toBe('October');
    expect(months[0].totalDays).toBe(31);
    expect(months[0].dates[0]).toBe('2026-10-01');
    expect(months[0].dates[30]).toBe('2026-10-31');

    expect(months[1].name).toBe('November');
    expect(months[1].totalDays).toBe(30);
    expect(months[1].dates[0]).toBe('2026-11-01');
    expect(months[1].dates[29]).toBe('2026-11-30');

    expect(months[2].name).toBe('December');
    expect(months[2].totalDays).toBe(31);
    expect(months[2].dates[0]).toBe('2026-12-01');
    expect(months[2].dates[30]).toBe('2026-12-31');
  });

  it('correctly calculates days until start', () => {
    expect(getDaysUntilWinterArc('2026-09-27')).toBe(4);
    expect(getDaysUntilWinterArc('2026-09-30')).toBe(1);
    expect(getDaysUntilWinterArc('2026-10-01')).toBe(0);
    expect(getDaysUntilWinterArc('2026-10-15')).toBe(0);
  });

  it('correctly calculates day number within the arc', () => {
    expect(getWinterArcDayNumber('2026-09-27')).toBe(0);
    expect(getWinterArcDayNumber('2026-10-01')).toBe(1);
    expect(getWinterArcDayNumber('2026-10-31')).toBe(31);
    expect(getWinterArcDayNumber('2026-11-01')).toBe(32);
    expect(getWinterArcDayNumber('2026-12-31')).toBe(92);
  });

  describe('Strict Date Locking', () => {
    it('locks any date outside 2026-10-01 to 2026-12-31', () => {
      expect(isWinterArcDateLocked('2026-09-30', '2026-09-30')).toBe(true);
      expect(isWinterArcDateLocked('2027-01-01', '2027-01-01')).toBe(true);
    });

    it('strictly locks any date in the future relative to current EvoRyz day', () => {
      const today = '2026-10-10';
      // Future dates are locked
      expect(isWinterArcDateLocked('2026-10-11', today)).toBe(true);
      expect(isWinterArcDateLocked('2026-10-25', today)).toBe(true);
      expect(isWinterArcDateLocked('2026-11-01', today)).toBe(true);

      // Today and past dates within Arc are unlocked
      expect(isWinterArcDateLocked('2026-10-10', today)).toBe(false);
      expect(isWinterArcDateLocked('2026-10-09', today)).toBe(false);
      expect(isWinterArcDateLocked('2026-10-01', today)).toBe(false);
    });
  });

  describe('Winter Arc Stats Calculation', () => {
    const mockHabits: WinterArcHabit[] = [
      {
        id: 'habit-1',
        title: 'Morning Cardio',
        order: 0,
        completedDays: ['2026-10-01', '2026-10-02', '2026-10-03'],
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'habit-2',
        title: 'Deep Work 2h',
        order: 1,
        completedDays: ['2026-10-01', '2026-10-02'],
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];

    it('computes stats accurately on day 3', () => {
      const stats = calculateWinterArcStats(mockHabits, '2026-10-03');
      expect(stats.currentDay).toBe(3);
      // Both habits completed on 2026-10-01 and 2026-10-02 -> 2 full days
      expect(stats.daysCompleted).toBe(2);
      // Total eligible opportunities = 2 habits * 3 days = 6
      // 5 / 6 = 83%
      expect(stats.overallPercent).toBe(83);
    });

    it('computes per-habit stats accurately', () => {
      const stats = calculateWinterArcStats(mockHabits, '2026-10-03');
      expect(stats.perHabitStats[0].completedCount).toBe(3);
      expect(stats.perHabitStats[0].percent).toBe(100);
      expect(stats.perHabitStats[1].completedCount).toBe(2);
      expect(stats.perHabitStats[1].percent).toBe(67);
    });

    it('returns empty stats if before start date', () => {
      const stats = calculateWinterArcStats(mockHabits, '2026-09-27');
      expect(stats.currentDay).toBe(0);
      expect(stats.daysUntilStart).toBe(4);
      expect(stats.daysCompleted).toBe(0);
      expect(stats.overallPercent).toBe(0);
    });
  });
});
