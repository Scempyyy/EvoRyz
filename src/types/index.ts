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
  allowPings?: boolean;
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
export type WorkspaceTheme = 'default' | 'harry_potter' | 'stranger_things';

export interface WorkspaceMember {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  role?: 'owner' | 'admin' | 'member' | string;
  isMuted?: boolean;
  notificationsMuted?: boolean;
  lastSeen?: string;
  isOnline?: boolean;
  acceptedWinterArc?: boolean;
}

export interface Workspace {
  id: string;
  mode: Exclude<UsageMode, 'solo'>;
  name: string;
  inviteCode: string;
  members: WorkspaceMember[];
  avatarUrl?: string;
  theme?: WorkspaceTheme;
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
  senderAvatar?: string;
  type: 'text' | 'system' | 'image' | 'video' | 'voice' | 'file' | 'ai';
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  replyToMessage?: {
    id: string;
    senderName?: string;
    content: string;
    type?: string;
  };
  reactions?: string[];
  uri?: string;
  thumbnailUri?: string;
  attachmentName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: string;
  isSaved?: boolean;
  isPending?: boolean;
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
  type: 'completed' | 'streak' | 'created' | 'joined' | 'left';
  title: string;
  visibility: Visibility;
  timestamp: string;
}

export interface DailySummary {
  date: string;
  you: number;
  shared?: number;
}

export interface TeamGoal {
  id: string;
  workspaceId: string;
  title: string;
  target: number;
  current: number;
  unit?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  attachmentUrl?: string;
  thumbnailUrl?: string;
  isPinned?: boolean;
  reactions?: string[];
  replyToId?: string;
  replyToContent?: string;
  createdAt: string;
  updatedAt?: string;
  isPending?: boolean;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface OfflinePendingAction {
  id: string;
  type: 'send_message' | 'send_dm' | 'toggle_task' | 'add_task';
  payload: any;
  createdAt: number;
}

export interface WinterArcHabit {
  id: string;
  title: string;
  order: number;
  icon?: string;
  color?: string;
  completedDays: string[];
  createdAt: string;
}

export type WinterArcNotificationLevel = 'light' | 'normal' | 'lock_in';

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

export interface PingEvent {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  workspaceId: string;
  timestamp: string;
}

export * from './winterArc';
export * from './friends';
