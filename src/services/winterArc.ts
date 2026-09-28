import { evoryzDay } from './evoryzDay';

export const WINTER_ARC_START = '2026-10-01';
export const WINTER_ARC_END = '2026-12-31';
export const WINTER_ARC_TOTAL_DAYS = 92;

export interface WinterArcHabit {
  id: string;
  title: string;
  order: number;
  icon?: string;
  color?: string;
  completedDays: string[]; // ISO date string 'YYYY-MM-DD'
  createdAt: string;
}

export type WinterArcNotificationLevel = 'light' | 'normal' | 'lock_in';

export interface DistractingAppInfo {
  id: string;
  name: string;
  packageName: string;
  icon: string;
}

export const DISTRACTING_APPS: DistractingAppInfo[] = [
  { id: 'instagram', name: 'Instagram', packageName: 'com.instagram.android', icon: 'logo-instagram' },
  { id: 'youtube', name: 'YouTube', packageName: 'com.google.android.youtube', icon: 'logo-youtube' },
  { id: 'snapchat', name: 'Snapchat', packageName: 'com.snapchat.android', icon: 'chatbubble-ellipses-outline' },
  { id: 'reddit', name: 'Reddit', packageName: 'com.reddit.frontpage', icon: 'logo-reddit' },
  { id: 'tiktok', name: 'TikTok', packageName: 'com.zhiliaoapp.musically', icon: 'videocam-outline' },
  { id: 'games', name: 'Mobile Games', packageName: 'games', icon: 'game-controller-outline' },
];

export interface FocusGuardConfig {
  enabled: boolean;
  thresholdMinutes: number;
  selectedApps: string[];
}

export interface WinterArcState {
  accepted: boolean;
  acceptedAt?: string;
  habits: WinterArcHabit[];
  notificationLevel: WinterArcNotificationLevel;
  focusGuard: FocusGuardConfig;
}

export const defaultWinterArcState: WinterArcState = {
  accepted: false,
  habits: [],
  notificationLevel: 'normal',
  focusGuard: {
    enabled: false,
    thresholdMinutes: 30,
    selectedApps: ['instagram', 'youtube'],
  },
};

export interface MonthInfo {
  name: string;
  monthIndex: number; // 9 = Oct, 10 = Nov, 11 = Dec (0-indexed in JS)
  totalDays: number;
  year: number;
  dates: string[]; // Array of 'YYYY-MM-DD'
}

export function getWinterArcMonths(): MonthInfo[] {
  return [
    {
      name: 'October',
      monthIndex: 9,
      totalDays: 31,
      year: 2026,
      dates: Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`),
    },
    {
      name: 'November',
      monthIndex: 10,
      totalDays: 30,
      year: 2026,
      dates: Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`),
    },
    {
      name: 'December',
      monthIndex: 11,
      totalDays: 31,
      year: 2026,
      dates: Array.from({ length: 31 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`),
    },
  ];
}

/**
 * Returns current Arc day number (1..92), or 0 if before start, or 92 if past end.
 */
export function getWinterArcDayNumber(todayStr = evoryzDay()): number {
  if (todayStr < WINTER_ARC_START) return 0;
  if (todayStr > WINTER_ARC_END) return WINTER_ARC_TOTAL_DAYS;

  const startMs = new Date('2026-10-01T00:00:00').getTime();
  const currentMs = new Date(`${todayStr}T00:00:00`).getTime();
  const diffDays = Math.floor((currentMs - startMs) / (1000 * 60 * 60 * 24));
  return Math.min(WINTER_ARC_TOTAL_DAYS, Math.max(1, diffDays + 1));
}

/**
 * Returns days remaining until Winter Arc starts, or 0 if already started.
 */
export function getDaysUntilWinterArc(todayStr = evoryzDay()): number {
  if (todayStr >= WINTER_ARC_START) return 0;
  const startMs = new Date('2026-10-01T00:00:00').getTime();
  const currentMs = new Date(`${todayStr}T00:00:00`).getTime();
  return Math.max(0, Math.ceil((startMs - currentMs) / (1000 * 60 * 60 * 24)));
}

/**
 * Strict rule: User CANNOT fill future dates.
 * A date is locked if it is in the future relative to the current EvoRyz day boundary,
 * or if it falls outside the Oct 1 - Dec 31 window.
 */
export function isWinterArcDateLocked(dateStr: string, currentEvoDayStr = evoryzDay()): boolean {
  if (dateStr > currentEvoDayStr) return true;
  if (dateStr < WINTER_ARC_START) return true;
  if (dateStr > WINTER_ARC_END) return true;
  return false;
}

export interface WinterArcStats {
  currentDay: number;
  totalDays: number;
  daysUntilStart: number;
  daysCompleted: number;
  overallPercent: number;
  currentStreak: number;
  bestStreak: number;
  perHabitStats: { id: string; title: string; completedCount: number; eligibleDays: number; percent: number }[];
  monthlyProgress: {
    october: { completed: number; eligible: number; percent: number };
    november: { completed: number; eligible: number; percent: number };
    december: { completed: number; eligible: number; percent: number };
  };
}

export function calculateWinterArcStats(
  habits: WinterArcHabit[],
  currentEvoDayStr = evoryzDay()
): WinterArcStats {
  const currentDay = getWinterArcDayNumber(currentEvoDayStr);
  const daysUntilStart = getDaysUntilWinterArc(currentEvoDayStr);

  const months = getWinterArcMonths();
  const allEligibleDates: string[] = [];

  for (const m of months) {
    for (const d of m.dates) {
      if (d <= currentEvoDayStr && d >= WINTER_ARC_START) {
        allEligibleDates.push(d);
      }
    }
  }

  const eligibleCount = allEligibleDates.length;

  if (habits.length === 0 || eligibleCount === 0) {
    return {
      currentDay,
      totalDays: WINTER_ARC_TOTAL_DAYS,
      daysUntilStart,
      daysCompleted: 0,
      overallPercent: 0,
      currentStreak: 0,
      bestStreak: 0,
      perHabitStats: habits.map((h) => ({
        id: h.id,
        title: h.title,
        completedCount: 0,
        eligibleDays: eligibleCount,
        percent: 0,
      })),
      monthlyProgress: {
        october: { completed: 0, eligible: 0, percent: 0 },
        november: { completed: 0, eligible: 0, percent: 0 },
        december: { completed: 0, eligible: 0, percent: 0 },
      },
    };
  }

  // Per habit stats
  let totalCompletions = 0;
  const perHabitStats = habits.map((h) => {
    const validCompletions = h.completedDays.filter((d) => d <= currentEvoDayStr && d >= WINTER_ARC_START).length;
    totalCompletions += validCompletions;
    const percent = Math.min(100, Math.round((validCompletions / eligibleCount) * 100));
    return {
      id: h.id,
      title: h.title,
      completedCount: validCompletions,
      eligibleDays: eligibleCount,
      percent,
    };
  });

  const totalPossibleHabitEntries = habits.length * eligibleCount;
  const overallPercent = totalPossibleHabitEntries > 0
    ? Math.min(100, Math.round((totalCompletions / totalPossibleHabitEntries) * 100))
    : 0;

  // Day-level completion (all habits completed on that day)
  let daysCompleted = 0;
  const dayCompletionMap = new Map<string, boolean>();

  for (const date of allEligibleDates) {
    const allDone = habits.every((h) => h.completedDays.includes(date));
    dayCompletionMap.set(date, allDone);
    if (allDone) daysCompleted++;
  }

  // Calculate streaks
  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  // Sort dates chronologically
  const sortedDates = [...allEligibleDates].sort();

  for (const date of sortedDates) {
    if (dayCompletionMap.get(date)) {
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  // Current streak walking backwards from currentEvoDayStr
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const date = sortedDates[i];
    if (dayCompletionMap.get(date)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Monthly progress
  const getMonthStats = (prefix: string, totalDaysInMonth: number) => {
    const monthEligible = allEligibleDates.filter((d) => d.startsWith(prefix));
    const monthCompletions = habits.reduce((acc, h) => {
      return acc + h.completedDays.filter((d) => d.startsWith(prefix) && d <= currentEvoDayStr).length;
    }, 0);
    const possible = habits.length * monthEligible.length;
    const pct = possible > 0 ? Math.min(100, Math.round((monthCompletions / possible) * 100)) : 0;
    return {
      completed: monthCompletions,
      eligible: possible,
      percent: pct,
    };
  };

  return {
    currentDay,
    totalDays: WINTER_ARC_TOTAL_DAYS,
    daysUntilStart,
    daysCompleted,
    overallPercent,
    currentStreak,
    bestStreak,
    perHabitStats,
    monthlyProgress: {
      october: getMonthStats('2026-10', 31),
      november: getMonthStats('2026-11', 30),
      december: getMonthStats('2026-12', 31),
    },
  };
}
