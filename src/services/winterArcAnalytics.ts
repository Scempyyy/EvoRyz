import {
  WinterArcDay,
  WinterArcRule,
  WinterArcRuleCompletion,
  WinterArcMilestone,
  WinterArcMilestoneKey,
  WinterArcWeeklyRecap,
} from '@/src/types/winterArc';
import { PASSING_SCORE_THRESHOLD } from './winterArcScoring';

export interface MilestoneDef {
  key: WinterArcMilestoneKey;
  dayNumber: number;
  title: string;
  description: string;
}

export const WINTER_ARC_MILESTONES_DEF: MilestoneDef[] = [
  {
    key: 'day_7',
    dayNumber: 7,
    title: 'The First Week of Iron',
    description: '7 consecutive days in the Arc. The habit loop is taking root.',
  },
  {
    key: 'day_14',
    dayNumber: 14,
    title: 'Two Weeks of Discipline',
    description: '14 days locked in. Resistance is fading. Momentum is building.',
  },
  {
    key: 'day_30',
    dayNumber: 30,
    title: 'One Month of Evolution',
    description: '30 days in the frost. Your old identity is shattered.',
  },
  {
    key: 'day_50',
    dayNumber: 50,
    title: 'Half-Century Milestone',
    description: '50 days of execution. You are past the halfway mark of the Arc.',
  },
  {
    key: 'day_75',
    dayNumber: 75,
    title: 'Final Quarter Drive',
    description: '75 days locked in. The finish line is in sight. Finish strong.',
  },
  {
    key: 'completed',
    dayNumber: 92,
    title: 'Winter Arc Conquered',
    description: 'All days completed. You have completely evolved into your highest self.',
  },
];

/**
 * Checks if any milestone conditions are met that haven't been achieved yet.
 * @param currentDayNumber Current elapsed day number in the arc (1-based)
 * @param existingMilestones Milestones already recorded
 * @param winterArcId Winter Arc identifier
 * @param userId User identifier
 * @param totalDaysInArc Actual total duration of the arc in days (default: 92)
 */
export function checkNewMilestones(
  currentDayNumber: number,
  existingMilestones: WinterArcMilestone[],
  winterArcId: string,
  userId: string,
  totalDaysInArc: number = 92
): WinterArcMilestone[] {
  const existingKeys = new Set(existingMilestones.map((m) => m.milestoneKey));
  const newlyAchieved: WinterArcMilestone[] = [];

  for (const def of WINTER_ARC_MILESTONES_DEF) {
    if (def.key === 'completed') {
      if (currentDayNumber >= totalDaysInArc && !existingKeys.has('completed')) {
        newlyAchieved.push({
          id: `milestone-${def.key}-${Date.now()}`,
          winterArcId,
          userId,
          milestoneKey: 'completed',
          title: def.title,
          description: `All ${totalDaysInArc} days completed. You have completely evolved into your highest self.`,
          dayNumber: totalDaysInArc,
          achievedAt: new Date().toISOString(),
          notified: false,
        });
      }
    } else {
      if (
        def.dayNumber < totalDaysInArc &&
        currentDayNumber >= def.dayNumber &&
        !existingKeys.has(def.key)
      ) {
        newlyAchieved.push({
          id: `milestone-${def.key}-${Date.now()}`,
          winterArcId,
          userId,
          milestoneKey: def.key,
          title: def.title,
          description: def.description,
          dayNumber: def.dayNumber,
          achievedAt: new Date().toISOString(),
          notified: false,
        });
      }
    }
  }

  return newlyAchieved;
}

/**
 * Generates weekly recaps for every 7 elapsed days.
 */
export function generateWeeklyRecap(
  weekNumber: number,
  daysInWeek: WinterArcDay[],
  rules: WinterArcRule[],
  completions: WinterArcRuleCompletion[],
  previousRecap: WinterArcWeeklyRecap | null,
  winterArcId: string,
  userId: string
): WinterArcWeeklyRecap | null {
  if (daysInWeek.length === 0) return null;

  const startDate = daysInWeek[0].date;
  const endDate = daysInWeek[daysInWeek.length - 1].date;

  const totalScoreSum = daysInWeek.reduce((sum, d) => sum + d.score, 0);
  const weeklyScore = Math.round((totalScoreSum / daysInWeek.length) * 100) / 100;

  const passingDays = daysInWeek.filter((d) => d.score >= PASSING_SCORE_THRESHOLD || d.streakProtectionUsed).length;
  const consistencyPercent = Math.round((passingDays / daysInWeek.length) * 100);

  // Per rule strength analysis
  const ruleCompletionStats = new Map<string, { title: string; count: number }>();
  for (const r of rules) {
    ruleCompletionStats.set(r.id, { title: r.title, count: 0 });
  }

  const weekDates = new Set(daysInWeek.map((d) => d.date));
  for (const c of completions) {
    if (weekDates.has(c.date) && c.completed) {
      const entry = ruleCompletionStats.get(c.ruleId);
      if (entry) {
        entry.count++;
      }
    }
  }

  let strongestRuleTitle = 'All Habits';
  let weakestRuleTitle = 'All Habits';
  let maxCount = -1;
  let minCount = 999;

  for (const [, val] of ruleCompletionStats.entries()) {
    if (val.count > maxCount) {
      maxCount = val.count;
      strongestRuleTitle = val.title;
    }
    if (val.count < minCount) {
      minCount = val.count;
      weakestRuleTitle = val.title;
    }
  }

  let comparisonToPreviousWeek: number | null = null;
  let progressionTrend: 'improving' | 'steady' | 'declining' = 'steady';

  if (previousRecap) {
    comparisonToPreviousWeek = Math.round((weeklyScore - previousRecap.weeklyScore) * 100) / 100;
    if (comparisonToPreviousWeek >= 3.0) {
      progressionTrend = 'improving';
    } else if (comparisonToPreviousWeek <= -3.0) {
      progressionTrend = 'declining';
    } else {
      progressionTrend = 'steady';
    }
  }

  const streakEndOfWeek = daysInWeek[daysInWeek.length - 1].dayNumber;

  const summaryText = `Week ${weekNumber} finished with ${weeklyScore}% avg score and ${consistencyPercent}% consistency. Strongest: ${strongestRuleTitle}.`;

  return {
    id: `recap-week-${weekNumber}-${winterArcId}`,
    winterArcId,
    userId,
    weekNumber,
    startDate,
    endDate,
    weeklyScore,
    consistencyPercent,
    strongestRuleTitle,
    weakestRuleTitle,
    streakEndOfWeek,
    comparisonToPreviousWeek,
    progressionTrend,
    summaryText,
    createdAt: new Date().toISOString(),
  };
}

export interface DailyScoreGraphPoint {
  date: string;
  dayNumber: number;
  score: number;
  isPassing: boolean;
  streakProtectionUsed: boolean;
}

export interface RulePerformanceGraphItem {
  ruleId: string;
  title: string;
  completedDays: number;
  totalDays: number;
  percentage: number;
  color: string;
}

export interface WinterArcAnalyticsSummary {
  dailyScores: DailyScoreGraphPoint[];
  weeklyConsistency: { week: number; consistency: number }[];
  ruleBreakdown: RulePerformanceGraphItem[];
  totalEligibleDays: number;
  daysPassed: number;
  daysProtected: number;
  daysMissed: number;
}

/**
 * Builds clean graph data arrays for rendering in the Winter Arc dashboard.
 */
export function buildWinterArcAnalytics(
  days: WinterArcDay[],
  rules: WinterArcRule[],
  completions: WinterArcRuleCompletion[]
): WinterArcAnalyticsSummary {
  const dailyScores: DailyScoreGraphPoint[] = days.map((d) => ({
    date: d.date,
    dayNumber: d.dayNumber,
    score: d.score,
    isPassing: d.score >= PASSING_SCORE_THRESHOLD,
    streakProtectionUsed: d.streakProtectionUsed,
  }));

  let daysPassed = 0;
  let daysProtected = 0;
  let daysMissed = 0;

  for (const d of days) {
    if (d.streakProtectionUsed) {
      daysProtected++;
    } else if (d.score >= PASSING_SCORE_THRESHOLD) {
      daysPassed++;
    } else {
      daysMissed++;
    }
  }

  // Weekly consistency chunks (every 7 days)
  const weeklyConsistency: { week: number; consistency: number }[] = [];
  const chunkSize = 7;
  for (let i = 0; i < days.length; i += chunkSize) {
    const chunk = days.slice(i, i + chunkSize);
    const passCount = chunk.filter((d) => d.score >= PASSING_SCORE_THRESHOLD || d.streakProtectionUsed).length;
    const consistency = Math.round((passCount / chunk.length) * 100);
    weeklyConsistency.push({
      week: Math.floor(i / chunkSize) + 1,
      consistency,
    });
  }

  // Rule breakdown
  const completionMapByRule = new Map<string, number>();
  for (const r of rules) {
    completionMapByRule.set(r.id, 0);
  }

  for (const c of completions) {
    if (c.completed) {
      const count = completionMapByRule.get(c.ruleId) || 0;
      completionMapByRule.set(c.ruleId, count + 1);
    }
  }

  const totalDays = Math.max(1, days.length);
  const ruleBreakdown: RulePerformanceGraphItem[] = rules.map((r, idx) => {
    const completedDays = completionMapByRule.get(r.id) || 0;
    const percentage = Math.min(100, Math.round((completedDays / totalDays) * 100));
    const colors = ['#00F5D4', '#7357F6', '#FFB703', '#FB8500', '#219EBC', '#56D896', '#FF6D7A'];
    return {
      ruleId: r.id,
      title: r.title,
      completedDays,
      totalDays: days.length,
      percentage,
      color: r.color || colors[idx % colors.length],
    };
  });

  return {
    dailyScores,
    weeklyConsistency,
    ruleBreakdown,
    totalEligibleDays: days.length,
    daysPassed,
    daysProtected,
    daysMissed,
  };
}
