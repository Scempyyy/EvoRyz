export type WinterArcStatus = 'active' | 'completed' | 'abandoned';
export type WinterArcVisibility = 'public' | 'friends' | 'private';
export type WinterArcNotificationLevel = 'light' | 'normal' | 'lock_in';

export interface WinterArc {
  id: string;
  userId: string;
  title: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  status: WinterArcStatus;
  visibility: WinterArcVisibility;
  notificationLevel: WinterArcNotificationLevel;
  streakProtectionAvailable: boolean;
  currentStreak: number;
  bestStreak: number;
  overallScore: number;
  overallCompletion: number;
  createdAt: string;
  updatedAt: string;
}

export interface WinterArcRule {
  id: string;
  winterArcId: string;
  userId: string;
  title: string;
  description?: string;
  target: number;
  unit: string;
  weight: number; // 1 to 10
  orderIndex: number;
  enabled: boolean;
  icon?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WinterArcDay {
  id: string;
  winterArcId: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  dayNumber: number;
  score: number; // 0..100
  completedRulesCount: number;
  totalRulesCount: number;
  weightedCompletion: number;
  streakProtectionUsed: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WinterArcRuleCompletion {
  id: string;
  winterArcId: string;
  ruleId: string;
  userId: string;
  date: string;
  value: number;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type WinterArcMilestoneKey = 'day_7' | 'day_14' | 'day_30' | 'day_50' | 'day_75' | 'completed';

export interface WinterArcMilestone {
  id: string;
  winterArcId: string;
  userId: string;
  milestoneKey: WinterArcMilestoneKey;
  title: string;
  description: string;
  dayNumber: number;
  achievedAt: string;
  notified: boolean;
}

export interface WinterArcStreakProtection {
  id: string;
  winterArcId: string;
  userId: string;
  weekIdentifier: string; // 'YYYY-Www'
  consumedForDate: string;
  consumedAt: string;
}

export interface WinterArcWeeklyRecap {
  id: string;
  winterArcId: string;
  userId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  weeklyScore: number;
  consistencyPercent: number;
  strongestRuleTitle: string;
  weakestRuleTitle: string;
  streakEndOfWeek: number;
  comparisonToPreviousWeek: number | null;
  progressionTrend: 'improving' | 'steady' | 'declining';
  summaryText: string;
  createdAt: string;
}

export interface WinterArcLeaderboardEntry {
  rank: number;
  winterArcId: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string;
  currentStreak: number;
  bestStreak: number;
  overallScore: number;
  overallCompletion: number;
  status: string;
}

export interface SpectateWinterArcData {
  winterArc: WinterArc;
  rules: WinterArcRule[];
  days: WinterArcDay[];
  milestones: WinterArcMilestone[];
  ownerProfile: {
    name: string;
    username: string;
    avatarUrl: string;
  };
}

export interface WinterArcSetupConfig {
  title?: string;
  startDate: string;
  endDate: string;
  visibility: WinterArcVisibility;
  notificationLevel: WinterArcNotificationLevel;
  rules: Omit<WinterArcRule, 'id' | 'winterArcId' | 'userId' | 'createdAt' | 'updatedAt'>[];
}

export const DEFAULT_WINTER_ARC_RULES: Omit<WinterArcRule, 'id' | 'winterArcId' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Wake up early (06:00)',
    description: 'Rise before the sun. No snoozing.',
    target: 1,
    unit: 'wake',
    weight: 2,
    orderIndex: 0,
    enabled: true,
    icon: 'alarm-outline',
    color: '#FFB703',
  },
  {
    title: '45-Min Intense Workout',
    description: 'Strength or endurance session every day.',
    target: 45,
    unit: 'mins',
    weight: 3,
    orderIndex: 1,
    enabled: true,
    icon: 'barbell-outline',
    color: '#FB8500',
  },
  {
    title: '2-Hour Deep Focus Block',
    description: 'Zero notifications. High leverage execution.',
    target: 120,
    unit: 'mins',
    weight: 3,
    orderIndex: 2,
    enabled: true,
    icon: 'flash-outline',
    color: '#00F5D4',
  },
  {
    title: '3 Liters Clean Water',
    description: 'Maintain optimal hydration all day.',
    target: 3,
    unit: 'liters',
    weight: 1,
    orderIndex: 3,
    enabled: true,
    icon: 'water-outline',
    color: '#219EBC',
  },
  {
    title: 'Read 10 Pages',
    description: 'Non-fiction, philosophy, or craft improvement.',
    target: 10,
    unit: 'pages',
    weight: 2,
    orderIndex: 4,
    enabled: true,
    icon: 'book-outline',
    color: '#8338EC',
  },
  {
    title: 'Zero Junk Food & Alcohol',
    description: 'Clean fuel only. Iron self-control.',
    target: 1,
    unit: 'day',
    weight: 2,
    orderIndex: 5,
    enabled: true,
    icon: 'shield-checkmark-outline',
    color: '#56D896',
  },
];
