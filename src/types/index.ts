export type Visibility = 'private' | 'shared';
export type HabitType = 'build' | 'avoid';
export type UsageMode = 'solo' | 'duo' | 'team';

export interface NotificationSettings {
  enabled: boolean;
  dailyReminder: boolean;
  recapReminder: boolean;
  reminderTime: string;
}

export interface AppPreferences {
  defaultVisibility: Visibility;
  theme: 'dark';
  haptics: boolean;
  sfx: boolean;
}

export interface User {
  id: string;
  email?: string;
  name: string;
  username: string;
  avatar: string;
  settings: {
    timezone: string;
    notifications: NotificationSettings;
    preferences: AppPreferences;
  };
}

/** A workspace is the shared boundary. Solo deliberately has no workspace. */
export interface WorkspaceMember {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  role?: string;
}

export interface Workspace {
  id: string;
  mode: Exclude<UsageMode, 'solo'>;
  name: string;
  inviteCode: string;
  members: WorkspaceMember[];
  avatarUrl?: string;
}

export interface DailyTask {
  id: string;
  ownerId: string;
  workspaceId?: string;
  title: string;
  description?: string;
  visibility: Visibility;
  date: string;
  completed: boolean;
  reminder?: string;
  category?: string;
  streak?: number;
}

export interface Habit {
  id: string;
  ownerId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  type: HabitType;
  visibility: Visibility;
  frequency: 'daily';
  currentStreak: number;
  bestStreak: number;
  history: string[];
  completedToday: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  complete: boolean;
}

export interface Goal {
  id: string;
  ownerId: string;
  workspaceId?: string;
  title: string;
  description: string;
  visibility: Visibility;
  progress: number;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  milestones: Milestone[];
}

export interface Message {
  id: string;
  workspaceId?: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  type: 'text' | 'system' | 'image' | 'video' | 'voice' | 'file';
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  reactions?: string[];
  uri?: string;
  thumbnailUri?: string;
  attachmentName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface JournalEntry {
  id: string;
  ownerId: string;
  encryptedContent: string;
  iv: string;
  tag?: string;
  algorithm: string;
  date: string; // EvoRyz day (02:00 -> 01:59)
  timestamp: string;
  decryptedPlaintext?: string; // In-memory only when unlocked
}

export interface Meal {
  id: string;
  ownerId: string;
  workspaceId?: string;
  name: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portion?: string;
  notes?: string;
  photoUri?: string;
  visibility: Visibility;
  date: string;
  aiEstimated?: boolean;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  workspaceId?: string;
  type: 'completed' | 'streak' | 'created';
  title: string;
  visibility: Visibility;
  timestamp: string;
}

export interface DailySummary {
  date: string;
  you: number;
  shared?: number;
}
