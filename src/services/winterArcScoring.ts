import {
  WinterArcRule,
  WinterArcRuleCompletion,
  WinterArcDay,
} from '@/src/types/winterArc';
import { evoryzDay } from './evoryzDay';

export const PASSING_SCORE_THRESHOLD = 70.0; // 70% weighted score required for streak increment

/**
 * Returns ISO week string (e.g. '2026-W40') for weekly streak protection replenishment.
 */
export function getIsoWeekIdentifier(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface DayScoreResult {
  date: string;
  dayNumber: number;
  score: number; // 0..100
  completedRulesCount: number;
  totalRulesCount: number;
  weightedCompletion: number; // 0..100
  isPassing: boolean;
}

/**
 * Calculates deterministic daily score based on enabled rules and their weights.
 */
export function calculateDailyScore(
  rules: WinterArcRule[],
  completions: WinterArcRuleCompletion[],
  date: string,
  dayNumber: number
): DayScoreResult {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) {
    return {
      date,
      dayNumber,
      score: 0,
      completedRulesCount: 0,
      totalRulesCount: 0,
      weightedCompletion: 0,
      isPassing: false,
    };
  }

  const completionMap = new Map<string, WinterArcRuleCompletion>();
  for (const c of completions) {
    if (c.date === date) {
      completionMap.set(c.ruleId, c);
    }
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let completedCount = 0;

  for (const rule of enabledRules) {
    const weight = Math.max(1, rule.weight || 1);
    totalWeight += weight;

    const comp = completionMap.get(rule.id);
    if (comp) {
      if (comp.completed) {
        earnedWeight += weight;
        completedCount++;
      } else if (comp.value > 0 && rule.target > 0) {
        // Partial proportional progress
        const ratio = Math.min(1.0, comp.value / rule.target);
        earnedWeight += weight * ratio;
        if (ratio >= 1.0) completedCount++;
      }
    }
  }

  const rawScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
  const score = Math.round(rawScore * 100) / 100;
  const weightedCompletion = score;
  const isPassing = score >= PASSING_SCORE_THRESHOLD;

  return {
    date,
    dayNumber,
    score,
    completedRulesCount: completedCount,
    totalRulesCount: enabledRules.length,
    weightedCompletion,
    isPassing,
  };
}

export interface StreakEvaluationResult {
  currentStreak: number;
  bestStreak: number;
  streakProtectionAvailable: boolean;
  streakProtectionUsedToday: boolean;
  daysWithProtection: string[];
}

/**
 * Evaluates current and best streaks with automatic 1-per-week streak protection.
 * @param sortedDays Chronologically ordered WinterArcDay array
 * @param todayStr Current EvoRyz day (defaults to evoryzDay())
 * @param existingProtections Weeks that have already consumed streak protection
 */
export function evaluateStreaksAndProtection(
  sortedDays: WinterArcDay[],
  todayStr = evoryzDay(),
  existingProtections: { weekIdentifier: string; consumedForDate: string }[] = []
): StreakEvaluationResult {
  const currentWeekId = getIsoWeekIdentifier(new Date(`${todayStr}T12:00:00Z`));
  const usedWeeksSet = new Set(existingProtections.map((p) => p.weekIdentifier));
  const protectedDatesSet = new Set(existingProtections.map((p) => p.consumedForDate));

  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;
  let streakProtectionUsedToday = false;
  const newlyProtectedDates: string[] = [];

  for (const day of sortedDays) {
    if (day.date > todayStr) continue;

    const isPassing = day.score >= PASSING_SCORE_THRESHOLD;
    const weekId = getIsoWeekIdentifier(new Date(`${day.date}T12:00:00Z`));

    if (isPassing) {
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      // Check if day was already protected or can consume protection for its week
      if (protectedDatesSet.has(day.date) || day.streakProtectionUsed) {
        runningStreak++;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else if (!usedWeeksSet.has(weekId)) {
        // Automatically consume protection for this week
        usedWeeksSet.add(weekId);
        protectedDatesSet.add(day.date);
        newlyProtectedDates.push(day.date);
        if (day.date === todayStr) {
          streakProtectionUsedToday = true;
        }
        runningStreak++;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else {
        // Missed with no protection available for this week
        runningStreak = 0;
      }
    }
  }

  // Calculate current streak walking backward from today
  currentStreak = runningStreak;

  const streakProtectionAvailable = !usedWeeksSet.has(currentWeekId);

  return {
    currentStreak,
    bestStreak,
    streakProtectionAvailable,
    streakProtectionUsedToday,
    daysWithProtection: Array.from(protectedDatesSet),
  };
}

/**
 * Calculates overall completion percentage and average overall score.
 */
export function calculateOverallProgress(
  days: WinterArcDay[],
  totalDaysInArc: number
): { overallScore: number; overallCompletion: number; completedDaysCount: number } {
  if (days.length === 0 || totalDaysInArc === 0) {
    return { overallScore: 0, overallCompletion: 0, completedDaysCount: 0 };
  }

  let totalScoreSum = 0;
  let completedDaysCount = 0;

  for (const day of days) {
    totalScoreSum += day.score;
    if (day.score >= PASSING_SCORE_THRESHOLD || day.streakProtectionUsed) {
      completedDaysCount++;
    }
  }

  const averageScore = Math.round((totalScoreSum / days.length) * 100) / 100;
  const overallCompletion = Math.min(100, Math.round((completedDaysCount / totalDaysInArc) * 10000) / 100);

  return {
    overallScore: averageScore,
    overallCompletion,
    completedDaysCount,
  };
}
