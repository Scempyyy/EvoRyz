import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import {
  ActivityEvent,
  DailySummary,
  DailyTask,
  Goal,
  Habit,
  Meal,
  Message,
  NotificationSettings,
  UsageMode,
  User,
  Visibility,
  Workspace,
  JournalEntry,
  WorkspaceTheme,
  TeamGoal,
  DirectMessage,
} from '@/src/types';
import { evoryzDay } from '@/src/services/evoryzDay';
import { journalCrypto, JournalSecurityConfig, EncryptedPayload } from '@/src/services/encryption';
import { completionPercent, sharedPercent } from '@/src/services/recaps';
import {
  localNotificationScheduler,
  sendPeerMessageNotification,
  triggerDailyRecapNotification,
} from '@/src/services/notifications';
import { feedback } from '@/src/services/feedback';
import { sfx } from '@/src/services/sfx';
import { authService } from '@/src/services/auth';
import { supabaseRepo } from '@/src/services/supabaseRepository';
import { supabase } from '@/utils/supabase';
import { generateUUID, ensureUUID, isUUID } from '@/src/utils/uuid';

export type ChatConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED';

const storageKey = 'evoryz.local-state.v3';
const stamp = () => new Date().toISOString();
const newId = () => generateUUID();

const notificationDefaults: NotificationSettings = {
  enabled: true,
  dailyReminder: true,
  recapReminder: true,
  reminderTime: '08:00',
};

const defaultPreferences = {
  defaultVisibility: 'private' as Visibility,
  theme: 'dark' as const,
  haptics: true,
  sfx: true,
};

function defaultUser(id = 'unauthenticated'): User {
  return {
    id,
    name: 'EvoRyz Member',
    username: 'member',
    avatar: 'E',
    settings: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notifications: notificationDefaults,
      preferences: defaultPreferences,
    },
  };
}

/** Fresh account seed: Exactly ONE starter task, ONE habit, ONE goal, ZERO meals, ZERO fake journal/chat/history */
function seed(day: string, ownerId: string) {
  return {
    tasks: [
      {
        id: generateUUID(),
        ownerId,
        title: 'Welcome to EvoRyz — tap to complete',
        visibility: 'private' as Visibility,
        date: day,
        completed: false,
        category: 'Personal',
        streak: 0,
      },
    ] as DailyTask[],
    habits: [
      {
        id: generateUUID(),
        ownerId,
        name: 'Morning focus session',
        type: 'build' as const,
        visibility: 'private' as Visibility,
        frequency: 'daily' as const,
        currentStreak: 0,
        bestStreak: 0,
        history: [],
        completedToday: false,
      },
    ] as Habit[],
    goals: [
      {
        id: generateUUID(),
        ownerId,
        title: 'Achieve my core goal',
        description: 'Break down your vision into weekly wins.',
        visibility: 'private' as Visibility,
        progress: 0,
        deadline: 'In 30 days',
        priority: 'medium' as const,
        category: 'Personal',
        milestones: [{ id: generateUUID(), title: 'Define scope & first milestone', complete: false }],
      },
    ] as Goal[],
    meals: [] as Meal[],
    messages: [] as Message[],
    journal: [] as JournalEntry[],
    activities: [] as ActivityEvent[],
  };
}

type State = ReturnType<typeof seed> & {
  user: User;
  activeDay: string;
  summaries: DailySummary[];
  hasCompletedSetup: boolean;
  mode?: UsageMode;
  workspace?: Workspace;
  journalSecurity?: JournalSecurityConfig | null;
};

const initial = (userId = 'unauthenticated'): State => ({
  user: defaultUser(userId),
  activeDay: evoryzDay(),
  summaries: [],
  hasCompletedSetup: false,
  journalSecurity: null,
  ...seed(evoryzDay(), userId),
});

type Ctx = State & {
  hydrated: boolean;
  session: Session | null;
  dailyPercent: number;
  sharedDailyPercent: number;
  streak: number;
  hasWorkspace: boolean;
  workspaceLabel: string;
  isJournalUnlocked: boolean;
  decryptedJournalEntries: { id: string; plaintext: string; timestamp: string; date: string }[];
  configureMode: (mode: UsageMode, name?: string) => void;
  createWorkspace: (name: string, mode: 'duo' | 'team') => Promise<{ success: boolean; error?: string }>;
  joinWorkspace: (inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  leaveWorkspace: () => Promise<{ success: boolean; error?: string }>;
  updateUsername: (newUsername: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  toggleTask: (id: string) => void;
  addTask: (title: string, visibility: Visibility) => void;
  deleteTask: (id: string) => void;
  toggleHabit: (id: string) => void;
  addHabit: (name: string, type: Habit['type'], visibility: Visibility) => void;
  deleteHabit: (id: string) => void;
  addGoal: (title: string, visibility: Visibility) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  deleteGoal: (id: string) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  updatePreferences: (patch: Partial<User['settings']['preferences']>) => void;
  sendMessage: (
    content: string,
    conversation: string,
    type?: Message['type'],
    attachment?: Pick<
      Message,
      'uri' | 'thumbnailUri' | 'attachmentName' | 'mimeType' | 'size' | 'width' | 'height' | 'duration'
    >
  ) => void;
  addMeal: (meal: Omit<Meal, 'id' | 'ownerId' | 'date' | 'workspaceId'>) => void;
  updateMeal: (meal: Meal) => void;
  deleteMeal: (id: string) => void;
  uploadUserAvatar: (localUri: string) => Promise<string | null>;
  removeUserAvatar: () => Promise<boolean>;
  uploadWorkspaceAvatar: (localUri: string) => Promise<string | null>;
  updateWorkspaceIdentity: (name?: string, avatarUrl?: string | null) => Promise<boolean>;
  dailyRecap: () => DailySummary;
  // Journal Security & Content Methods
  unlockJournal: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockJournal: () => void;
  setupJournalPin: (pin: string) => Promise<void>;
  changeJournalPin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  resetJournalPin: (newPin: string) => Promise<void>;
  addJournalEntry: (content: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  refreshWorkspaceMessages: () => Promise<void>;
  isChatConnected: boolean;
  chatConnectionStatus: ChatConnectionStatus;
  retryChatConnection: () => void;
  // Evolution 2.0 Additions:
  changeTheme: (theme: WorkspaceTheme) => Promise<boolean>;
  setMemberRole: (targetUserId: string, role: 'admin' | 'member') => Promise<boolean>;
  setMemberMuted: (targetUserId: string, isMuted: boolean) => Promise<boolean>;
  removeMember: (targetUserId: string) => Promise<boolean>;
  toggleWorkspaceNotifications: (muted: boolean) => Promise<boolean>;
  togglePinMessage: (messageId: string, isPinned: boolean) => Promise<boolean>;
  bookmarkMessage: (messageId: string) => Promise<boolean>;
  removeBookmark: (messageId: string) => Promise<boolean>;
  savedMessageIds: string[];
  teamGoals: TeamGoal[];
  createTeamGoal: (title: string, targetCount: number, unit?: string) => Promise<boolean>;
  updateTeamGoal: (goalId: string, currentCount: number, completed?: boolean) => Promise<boolean>;
  deleteTeamGoal: (goalId: string) => Promise<boolean>;
  refreshTeamGoals: () => Promise<void>;
  directMessages: DirectMessage[];
  sendDirectMessage: (
    recipientId: string,
    content: string,
    type?: DirectMessage['type'],
    attachment?: Pick<DirectMessage, 'attachmentUrl' | 'thumbnailUrl'>
  ) => Promise<boolean>;
  deleteDirectMessage: (messageId: string) => Promise<boolean>;
  fetchDirectMessages: (peerId: string) => Promise<DirectMessage[]>;
  searchUsers: (query: string) => Promise<{ id: string; name: string; username: string; avatar: string }[]>;
  deleteUserAccount: () => Promise<boolean>;
  exportUserData: () => Promise<string | null>;
  isOnline: boolean;
};

const Context = createContext<Ctx | null>(null);

function rollover(state: State): State {
  const today = evoryzDay();
  if (state.activeDay === today) return state;

  const summary = {
    date: state.activeDay,
    you: completionPercent(state.tasks),
    shared: state.workspace ? sharedPercent(state.tasks) : undefined,
  };

  if (state.user?.settings?.notifications?.recapReminder) {
    const taskPct = completionPercent(state.tasks);
    const habitsCompleted = state.habits.filter((h) => h.completedToday).length;
    const habitPct = state.habits.length > 0 ? Math.round((habitsCompleted / state.habits.length) * 100) : 0;
    const overallPct = Math.round(
      (taskPct + habitPct) / (state.habits.length > 0 && state.tasks.length > 0 ? 2 : 1)
    );

    void triggerDailyRecapNotification({
      day: state.activeDay,
      tasksCompleted: state.tasks.filter((t) => t.completed).length,
      totalTasks: state.tasks.length,
      habitsCompleted,
      totalHabits: state.habits.length,
      mealsCount: state.meals.length,
      overallPercent: overallPct,
    });
  }

  return {
    ...state,
    activeDay: today,
    summaries: [...state.summaries, summary].slice(-7),
    tasks: state.tasks.map((task) => ({ ...task, date: today, completed: false })),
    habits: state.habits.map((habit) => ({
      ...habit,
      currentStreak: habit.completedToday ? habit.currentStreak : 0,
      completedToday: false,
    })),
    activities: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial());
  const [session, setSession] = useState<Session | null>(null);
  const [localHydrated, setLocalHydrated] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const hydrated = localHydrated && authHydrated;
  const [isJournalUnlocked, setIsJournalUnlocked] = useState(false);
  const [decryptedEntries, setDecryptedEntries] = useState<
    { id: string; plaintext: string; timestamp: string; date: string }[]
  >([]);
  const [chatConnectionStatus, setChatConnectionStatus] = useState<ChatConnectionStatus>('DISCONNECTED');
  const [chatRetryTrigger, setChatRetryTrigger] = useState(0);
  const [savedMessageIds, setSavedMessageIds] = useState<string[]>([]);
  const [teamGoals, setTeamGoals] = useState<TeamGoal[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // 1. Hydrate local cached state and sound effects on launch
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (saved) {
          const stored = JSON.parse(saved) as Partial<State>;
          setState((prev) => {
            const raw: State = {
              ...prev,
              ...stored,
              tasks: (stored.tasks ?? prev.tasks).map((t) => ({ ...t, id: ensureUUID(t.id) })),
              habits: (stored.habits ?? prev.habits).map((h) => ({ ...h, id: ensureUUID(h.id) })),
              goals: (stored.goals ?? prev.goals).map((g) => ({
                ...g,
                id: ensureUUID(g.id),
                milestones: (g.milestones ?? []).map((m) => ({ ...m, id: ensureUUID(m.id) })),
              })),
              meals: (stored.meals ?? []).map((m) => ({ ...m, id: ensureUUID(m.id) })),
              messages: (stored.messages ?? []).map((m) => ({ ...m, id: ensureUUID(m.id) })),
              journal: (stored.journal ?? []).map((j) => ({ ...j, id: ensureUUID(j.id) })),
              activities: (stored.activities ?? []).map((a) => ({ ...a, id: ensureUUID(a.id) })),
              workspace: stored.workspace
                ? {
                    ...stored.workspace,
                    id: ensureUUID(stored.workspace.id),
                    members: (stored.workspace.members ?? []).map((mem) => ({
                      ...mem,
                      id: ensureUUID(mem.id),
                    })),
                  }
                : undefined,
              user: {
                ...prev.user,
                ...stored.user,
                settings: {
                  ...prev.user.settings,
                  ...stored.user?.settings,
                  preferences: {
                    ...prev.user.settings.preferences,
                    ...stored.user?.settings?.preferences,
                  },
                  notifications: {
                    ...notificationDefaults,
                    ...stored.user?.settings?.notifications,
                  },
                },
              },
            };
            return rollover(raw);
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLocalHydrated(true));
  }, []);

  useEffect(() => {
    void sfx.hydrate();
    return () => sfx.dispose();
  }, []);

  // 2. Persist state to local AsyncStorage
  useEffect(() => {
    if (hydrated) {
      AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
    }
  }, [state, hydrated]);

  const syncAuthenticatedUser = async (userSession: Session) => {
    const sUser = userSession.user;
    const uid = sUser.id;
    const email = sUser.email;
    const fullName =
      sUser.user_metadata?.full_name ||
      sUser.user_metadata?.name ||
      email?.split('@')[0] ||
      'EvoRyz User';
    const username =
      sUser.user_metadata?.user_name ||
      email?.split('@')[0] ||
      'user';
    const avatar =
      sUser.user_metadata?.avatar_url ||
      sUser.user_metadata?.picture ||
      fullName.charAt(0).toUpperCase() ||
      'U';

    const authenticatedUser: User = {
      id: uid,
      email,
      name: fullName,
      username,
      avatar,
      settings: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: notificationDefaults,
        preferences: defaultPreferences,
      },
    };

    // Update state with real user ID and migrate items ensuring UUIDs
    setState((prev) => ({
      ...prev,
      user: { ...prev.user, ...authenticatedUser },
      hasCompletedSetup: true,
      tasks: prev.tasks.map((t) => (t.ownerId === 'me' || t.ownerId === 'unauthenticated' || !isUUID(t.ownerId) ? { ...t, ownerId: uid, id: ensureUUID(t.id) } : { ...t, id: ensureUUID(t.id) })),
      habits: prev.habits.map((h) => (h.ownerId === 'me' || h.ownerId === 'unauthenticated' || !isUUID(h.ownerId) ? { ...h, ownerId: uid, id: ensureUUID(h.id) } : { ...h, id: ensureUUID(h.id) })),
      goals: prev.goals.map((g) => (g.ownerId === 'me' || g.ownerId === 'unauthenticated' || !isUUID(g.ownerId) ? { ...g, ownerId: uid, id: ensureUUID(g.id) } : { ...g, id: ensureUUID(g.id) })),
      meals: prev.meals.map((m) => (m.ownerId === 'me' || m.ownerId === 'unauthenticated' || !isUUID(m.ownerId) ? { ...m, ownerId: uid, id: ensureUUID(m.id) } : { ...m, id: ensureUUID(m.id) })),
      journal: prev.journal.map((j) => (j.ownerId === 'me' || j.ownerId === 'unauthenticated' || !isUUID(j.ownerId) ? { ...j, ownerId: uid, id: ensureUUID(j.id) } : { ...j, id: ensureUUID(j.id) })),
    }));

    // Ensure profile in Supabase
    void supabaseRepo.ensureProfile({
      id: uid,
      email,
      name: fullName,
      username,
      avatar,
    });

    // Fetch cloud data
    try {
      const today = evoryzDay();
      const [dbTasks, dbHabits, dbGoals, dbMeals, dbJournal, dbSecurity, dbWorkspace, dbProfile] = await Promise.all([
        supabaseRepo.fetchTasks(uid, today),
        supabaseRepo.fetchHabits(uid),
        supabaseRepo.fetchGoals(uid),
        supabaseRepo.fetchMeals(uid, today),
        supabaseRepo.fetchJournalEntries(uid),
        supabaseRepo.fetchJournalSecurity(uid),
        supabaseRepo.fetchUserWorkspace(uid),
        supabaseRepo.getProfile(uid),
      ]);

      setState((prev) => {
        let resolvedWorkspace = prev.workspace;
        let resolvedMode = prev.mode;

        if (dbWorkspace) {
          // Cloud confirmed active workspace -> Source of Truth
          resolvedMode = dbWorkspace.mode;
          if (dbWorkspace.members.length > 0) {
            resolvedWorkspace = dbWorkspace;
          } else if (prev.workspace?.id === dbWorkspace.id && prev.workspace.members.length > 0) {
            resolvedWorkspace = { ...dbWorkspace, members: prev.workspace.members };
          } else {
            resolvedWorkspace = {
              ...dbWorkspace,
              members: [{ id: uid, name: fullName || 'You', avatar: dbProfile?.avatar || avatar || 'Y' }],
            };
          }
        } else if (dbWorkspace === null) {
          // Only switch to Solo if user genuinely does not belong to any workspace
          // AND we don't have an active workspace already loaded from storage
          if (!prev.workspace || !prev.workspace.id) {
            resolvedWorkspace = undefined;
            resolvedMode = 'solo';
          }
        }

        const resolvedUserAvatar = dbProfile?.avatar || prev.user.avatar || avatar;

        return {
          ...prev,
          user: {
            ...prev.user,
            avatar: resolvedUserAvatar,
          },
          mode: resolvedMode,
          tasks: dbTasks.length ? dbTasks : prev.tasks,
          habits: dbHabits.length ? dbHabits : prev.habits,
          goals: dbGoals.length ? dbGoals : prev.goals,
          meals: dbMeals.length ? dbMeals : prev.meals,
          journal: dbJournal.length ? dbJournal : prev.journal,
          journalSecurity: dbSecurity ?? prev.journalSecurity,
          workspace: resolvedWorkspace,
        };
      });
      // Evolution 2.0: fetch savedMessageIds and presence
      void supabaseRepo.updateUserPresence(true);
      supabaseRepo.fetchSavedMessageIds(uid).then(setSavedMessageIds).catch(() => undefined);
    } catch (err) {
      console.warn('[AppContext] Cloud sync error:', err);
    }
  };

  // 3. Supabase Auth Session listener
  useEffect(() => {
    authService
      .getSession()
      .then(async (initialSession) => {
        if (initialSession) {
          setSession(initialSession);
          await syncAuthenticatedUser(initialSession);
        }
      })
      .catch(() => undefined)
      .finally(() => setAuthHydrated(true));

    const sub = authService.onAuthStateChange((newSession) => {
      setSession(newSession);
      if (newSession) {
        syncAuthenticatedUser(newSession);
      } else {
        // User logged out
        setState(initial('unauthenticated'));
        journalCrypto.lock();
        setIsJournalUnlocked(false);
        setDecryptedEntries([]);
        setSavedMessageIds([]);
        setTeamGoals([]);
        setDirectMessages([]);
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  // 3b. Evolution 2.0 Subscriptions: Team Goals, Direct Messages, Presence
  useEffect(() => {
    let active = true;
    const wsId = state.workspace?.id;
    if (!wsId || !isUUID(wsId)) {
      Promise.resolve().then(() => {
        if (active) setTeamGoals([]);
      });
      return () => {
        active = false;
      };
    }
    supabaseRepo
      .fetchTeamGoals(wsId)
      .then((goals) => {
        if (active) setTeamGoals(goals);
      })
      .catch(() => undefined);

    const unsub = supabaseRepo.subscribeToTeamGoals(wsId, () => {
      if (active) {
        supabaseRepo
          .fetchTeamGoals(wsId)
          .then((goals) => {
            if (active) setTeamGoals(goals);
          })
          .catch(() => undefined);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [state.workspace?.id]);

  useEffect(() => {
    const uid = session?.user?.id || state.user.id;
    if (!uid || !isUUID(uid)) return;
    const unsub = supabaseRepo.subscribeToDirectMessages(uid, (newDm: DirectMessage) => {
      setDirectMessages((prev) => {
        if (prev.some((m) => m.id === newDm.id)) return prev;
        return [...prev, newDm];
      });
      if (newDm.senderId !== uid && state.user.settings.preferences.sfx) {
        feedback.sound('messageReceived', true);
      }
    });
    return () => unsub();
  }, [session?.user?.id, state.user.id, state.user.settings.preferences.sfx]);

  useEffect(() => {
    const uid = session?.user?.id || state.user.id;
    if (!uid || !isUUID(uid)) return;

    const sub = AppState.addEventListener('change', (nextAppState) => {
      const active = nextAppState === 'active';
      setIsOnline(active);
      void supabaseRepo.updateUserPresence(active);
    });

    return () => {
      sub.remove();
    };
  }, [session?.user?.id, state.user.id]);

  // 4. Subscribe to Realtime messages when workspace and authenticated session are active
  useEffect(() => {
    const wsId = state.workspace?.id;
    const token = session?.access_token;
    const uid = session?.user?.id;

    if (!wsId || !isUUID(wsId) || !token || !uid || !isUUID(uid)) {
      return;
    }

    let active = true;

    supabaseRepo
      .fetchMessages('workspace', wsId)
      .then((fetched) => {
        if (active && fetched.length > 0) {
          setState((prev) => ({
            ...prev,
            messages: fetched,
          }));
        }
      })
      .catch((err) => console.warn('[AppContext] fetchMessages error:', err));

    const unsubscribe = supabaseRepo.subscribeToMessages(
      'workspace',
      (newMsg) => {
        const isFromMe = newMsg.senderId === (session?.user?.id || state.user.id);
        if (!isFromMe) {
          feedback.sound('messageReceived', state.user.settings.preferences.sfx);
          if (newMsg.type !== 'system' && state.user.settings.notifications.enabled) {
            const senderMember = state.workspace?.members?.find((m) => m.id === newMsg.senderId);
            const senderName = newMsg.senderName || senderMember?.name || 'Teammate';
            void sendPeerMessageNotification({
              messageId: newMsg.id,
              senderName,
              messageType: newMsg.type,
            });
          }
        }
        setState((prev) => {
          if (prev.messages.some((m) => m.id === newMsg.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, newMsg],
          };
        });
      },
      wsId,
      (status, err) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setChatConnectionStatus('CONNECTED');
        } else if (status === 'CONNECTING') {
          setChatConnectionStatus('CONNECTING');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[AppContext] Realtime subscription status error:', status, err?.message);
          setChatConnectionStatus('ERROR');
        } else if (status === 'CLOSED') {
          setChatConnectionStatus('DISCONNECTED');
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    state.workspace?.id,
    state.workspace?.members,
    session?.access_token,
    session?.user?.id,
    chatRetryTrigger,
    state.user.id,
    state.user.settings.preferences.sfx,
    state.user.settings.notifications.enabled,
  ]);

  // 5. Reconnect Realtime and refresh state when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          if (!supabase.realtime.isConnected()) {
            supabase.realtime.connect();
          }
        } catch {}
        setChatRetryTrigger((prev) => prev + 1);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // 6. Lock journal when app transitions to inactive or background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        journalCrypto.lock();
        setIsJournalUnlocked(false);
        setDecryptedEntries([]);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 6. Inactivity timeout watcher for unlocked journal session
  useEffect(() => {
    if (!isJournalUnlocked) return;

    const interval = setInterval(() => {
      if (!journalCrypto.isUnlocked()) {
        setIsJournalUnlocked(false);
        setDecryptedEntries([]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isJournalUnlocked]);

  const value = useMemo<Ctx>(() => {
    const update = (recipe: (previous: State) => State) =>
      setState((previous) => recipe(rollover(previous)));

    const dailyPercent = completionPercent(state.tasks);
    const sharedDailyPercent = sharedPercent(state.tasks);
    const streak = Math.max(0, ...state.habits.map((habit) => habit.currentStreak));
    const hasWorkspace = Boolean(state.workspace);
    const workspaceLabel = state.workspace?.name ?? 'Solo';

    return {
      ...state,
      hydrated,
      session,
      dailyPercent,
      sharedDailyPercent,
      streak,
      hasWorkspace,
      workspaceLabel,
      isJournalUnlocked,
      decryptedJournalEntries: decryptedEntries,

      configureMode: (mode, name) => {
        if (mode === 'solo') {
          void (async () => {
            const currentWsId = state.workspace?.id;
            const currentUid = state.user.id;
            if (currentWsId && isUUID(currentUid)) {
              await supabaseRepo.leaveWorkspace(currentUid, currentWsId);
            }
            update((previous) => ({
              ...previous,
              mode: 'solo',
              workspace: undefined,
              hasCompletedSetup: true,
              tasks: previous.tasks.map((item) => ({
                ...item,
                visibility: 'private',
                workspaceId: undefined,
              })),
              habits: previous.habits.map((item) => ({
                ...item,
                visibility: 'private',
                workspaceId: undefined,
              })),
              goals: previous.goals.map((item) => ({
                ...item,
                visibility: 'private',
                workspaceId: undefined,
              })),
              messages: [],
              activities: [],
            }));
          })();
          return;
        }

        const wsName = name?.trim() || (mode === 'duo' ? 'My Duo' : 'My Team');
        void (async () => {
          const currentUid = state.user.id;
          if (isUUID(currentUid)) {
            const dbWs = await supabaseRepo.createWorkspace(currentUid, wsName, mode);
            if (dbWs) {
              feedback.sound('workspaceConnected', state.user.settings.preferences.sfx);
              update((previous) => ({
                ...previous,
                mode,
                workspace: dbWs,
                hasCompletedSetup: true,
              }));
              return;
            }
          }

          const workspaceId = generateUUID();
          const members = [
            { id: state.user.id, name: state.user.name, avatar: state.user.avatar },
          ];
          const workspace: Workspace = {
            id: workspaceId,
            mode,
            name: wsName,
            inviteCode: `EVR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            members,
          };
          update((previous) => ({ ...previous, mode, workspace, hasCompletedSetup: true }));
        })();
      },

      createWorkspace: async (name: string, mode: 'duo' | 'team') => {
        const wsName = name.trim() || (mode === 'duo' ? 'My Duo' : 'My Team');
        feedback.tap(state.user.settings.preferences.haptics);
        const currentUid = state.user.id;

        if (isUUID(currentUid)) {
          const dbWs = await supabaseRepo.createWorkspace(currentUid, wsName, mode);
          if (dbWs) {
            feedback.sound('workspaceConnected', state.user.settings.preferences.sfx);
            update((p) => ({
              ...p,
              mode,
              workspace: dbWs,
              hasCompletedSetup: true,
            }));
            return { success: true };
          }
        }

        const workspace: Workspace = {
          id: generateUUID(),
          mode,
          name: wsName,
          inviteCode: `EVR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          members: [{ id: currentUid, name: state.user.name, avatar: state.user.avatar }],
        };
        update((p) => ({ ...p, mode, workspace, hasCompletedSetup: true }));
        return { success: true };
      },

      joinWorkspace: async (inviteCode: string) => {
        const cleanCode = inviteCode.trim().toUpperCase();
        if (!cleanCode) {
          return { success: false, error: 'Please enter a valid invite code.' };
        }

        feedback.tap(state.user.settings.preferences.haptics);
        const res = await supabaseRepo.joinWorkspaceByInviteCode(cleanCode, state.user.id);

        if (res.success && res.workspace) {
          feedback.success(state.user.settings.preferences.haptics);
          feedback.sound('workspaceConnected', state.user.settings.preferences.sfx);
          update((p) => ({
            ...p,
            mode: res.workspace!.mode,
            workspace: res.workspace,
            hasCompletedSetup: true,
          }));

          // Send system message indicating user joined the team
          const joinContent = `${state.user.name || 'A teammate'} joined the team`;
          const joinMsg: Message = {
            id: generateUUID(),
            workspaceId: res.workspace.id,
            conversationId: 'workspace',
            senderId: state.user.id,
            type: 'system',
            content: joinContent,
            timestamp: new Date().toISOString(),
            status: 'sent',
          };
          void supabaseRepo.insertMessage(joinMsg);

          void supabaseRepo.fetchMessages('workspace', res.workspace.id).then((msgs) => {
            if (msgs.length) {
              update((p) => ({ ...p, messages: msgs }));
            }
          });
          return { success: true };
        }

        feedback.error(state.user.settings.preferences.haptics);
        feedback.sound('error', state.user.settings.preferences.sfx);
        return { success: false, error: res.error || 'Could not join workspace.' };
      },

      leaveWorkspace: async () => {
        feedback.tap(state.user.settings.preferences.haptics);
        const currentWsId = state.workspace?.id;
        const currentUid = state.user.id;
        if (currentWsId && isUUID(currentUid)) {
          await supabaseRepo.leaveWorkspace(currentUid, currentWsId);
        }

        update((previous) => ({
          ...previous,
          mode: 'solo',
          workspace: undefined,
          tasks: previous.tasks.map((item) => ({
            ...item,
            visibility: 'private',
            workspaceId: undefined,
          })),
          habits: previous.habits.map((item) => ({
            ...item,
            visibility: 'private',
            workspaceId: undefined,
          })),
          goals: previous.goals.map((item) => ({
            ...item,
            visibility: 'private',
            workspaceId: undefined,
          })),
          messages: [],
          activities: [],
        }));
        return { success: true };
      },

      updateUsername: async (newUsername: string) => {
        const cleaned = newUsername.trim().toLowerCase();
        if (isUUID(state.user.id)) {
          const res = await supabaseRepo.updateUsername(state.user.id, cleaned);
          if (!res.success) {
            return res;
          }
        }
        update((p) => ({
          ...p,
          user: {
            ...p.user,
            username: cleaned,
          },
        }));
        return { success: true };
      },

      signOut: async () => {
        await authService.signOut();
        journalCrypto.lock();
        setIsJournalUnlocked(false);
        setDecryptedEntries([]);
        setState(initial('unauthenticated'));
        await AsyncStorage.removeItem(storageKey);
      },

      toggleTask: (taskId) =>
        update((previous) => {
          const task = previous.tasks.find((item) => item.id === taskId);
          if (!task) return previous;
          const completed = !task.completed;
          if (completed) feedback.success(previous.user.settings.preferences.haptics);
          else feedback.tap(previous.user.settings.preferences.haptics);
          feedback.sound(completed ? 'taskComplete' : 'tap', previous.user.settings.preferences.sfx);

          const updatedTask = { ...task, completed };
          void supabaseRepo.upsertTask(updatedTask);

          const activities =
            task.visibility === 'shared' && previous.workspace
              ? [
                  {
                    id: newId(),
                    userId: previous.user.id,
                    workspaceId: previous.workspace.id,
                    type: 'completed' as const,
                    title: completed ? task.title : `reopened ${task.title}`,
                    visibility: 'shared' as const,
                    timestamp: stamp(),
                  },
                  ...previous.activities,
                ].slice(0, 30)
              : previous.activities;

          return {
            ...previous,
            tasks: previous.tasks.map((item) => (item.id === taskId ? updatedTask : item)),
            activities,
          };
        }),

      addTask: (title, visibility) =>
        update((previous) => {
          const desired = visibility ?? previous.user.settings.preferences.defaultVisibility;
          const safeVisibility = previous.workspace && desired === 'shared' ? 'shared' : 'private';
          const newTask: DailyTask = {
            id: newId(),
            ownerId: previous.user.id,
            workspaceId: safeVisibility === 'shared' ? previous.workspace?.id : undefined,
            title,
            visibility: safeVisibility,
            date: previous.activeDay,
            completed: false,
          };
          void supabaseRepo.upsertTask(newTask);
          return { ...previous, tasks: [...previous.tasks, newTask] };
        }),

      deleteTask: (taskId) =>
        update((previous) => {
          void supabaseRepo.deleteTask(taskId);
          return { ...previous, tasks: previous.tasks.filter((t) => t.id !== taskId) };
        }),

      toggleHabit: (habitId) =>
        update((previous) => ({
          ...previous,
          habits: previous.habits.map((habit) => {
            if (habit.id !== habitId) return habit;
            const completedToday = !habit.completedToday;
            const currentStreak = completedToday
              ? habit.currentStreak + 1
              : Math.max(0, habit.currentStreak - 1);
            if (completedToday) {
              feedback.success(previous.user.settings.preferences.haptics);
              feedback.sound(
                [5, 7, 10, 14, 21, 30].includes(currentStreak)
                  ? 'streakMilestone'
                  : 'habitComplete',
                previous.user.settings.preferences.sfx
              );
            }
            const updatedHabit = {
              ...habit,
              completedToday,
              currentStreak,
              bestStreak: Math.max(habit.bestStreak, currentStreak),
              history: completedToday
                ? [...habit.history, previous.activeDay]
                : habit.history.filter((date) => date !== previous.activeDay),
            };
            void supabaseRepo.upsertHabit(updatedHabit);
            return updatedHabit;
          }),
        })),

      addHabit: (name, type, visibility) =>
        update((previous) => {
          const safeVisibility = previous.workspace && visibility === 'shared' ? 'shared' : 'private';
          const newHabit: Habit = {
            id: newId(),
            ownerId: previous.user.id,
            workspaceId: safeVisibility === 'shared' ? previous.workspace?.id : undefined,
            name,
            type,
            visibility: safeVisibility,
            frequency: 'daily',
            currentStreak: 0,
            bestStreak: 0,
            history: [],
            completedToday: false,
          };
          void supabaseRepo.upsertHabit(newHabit);
          return { ...previous, habits: [...previous.habits, newHabit] };
        }),

      deleteHabit: (habitId) =>
        update((previous) => {
          void supabaseRepo.deleteHabit(habitId);
          return { ...previous, habits: previous.habits.filter((h) => h.id !== habitId) };
        }),

      addGoal: (title, visibility) =>
        update((previous) => {
          const safeVisibility = previous.workspace && visibility === 'shared' ? 'shared' : 'private';
          const newGoal: Goal = {
            id: newId(),
            ownerId: previous.user.id,
            workspaceId: safeVisibility === 'shared' ? previous.workspace?.id : undefined,
            title,
            description: 'A promise to your future self.',
            visibility: safeVisibility,
            progress: 0,
            deadline: 'In 30 days',
            priority: 'medium',
            category: 'Personal',
            milestones: [],
          };
          void supabaseRepo.upsertGoal(newGoal);
          return { ...previous, goals: [...previous.goals, newGoal] };
        }),

      toggleMilestone: (goalId, milestoneId) =>
        update((previous) => ({
          ...previous,
          goals: previous.goals.map((goal) => {
            if (goal.id !== goalId) return goal;
            const milestones = goal.milestones.map((milestone) =>
              milestone.id === milestoneId
                ? { ...milestone, complete: !milestone.complete }
                : milestone
            );
            const progress = milestones.length
              ? Math.round(
                  (milestones.filter((milestone) => milestone.complete).length / milestones.length) * 100
                )
              : goal.progress;
            feedback.success(previous.user.settings.preferences.haptics);
            feedback.sound(progress === 100 ? 'goalComplete' : 'success', previous.user.settings.preferences.sfx);
            const updatedGoal = { ...goal, milestones, progress };
            void supabaseRepo.upsertGoal(updatedGoal);
            return updatedGoal;
          }),
        })),

      deleteGoal: (goalId) =>
        update((previous) => {
          void supabaseRepo.deleteGoal(goalId);
          return { ...previous, goals: previous.goals.filter((g) => g.id !== goalId) };
        }),

      updateNotifications: (patch) =>
        update((previous) => {
          const notifications = { ...previous.user.settings.notifications, ...patch };
          localNotificationScheduler.sync(notifications).catch(() => undefined);
          if (patch.enabled) {
            feedback.sound('notification', previous.user.settings.preferences.sfx);
          }
          return {
            ...previous,
            user: {
              ...previous.user,
              settings: { ...previous.user.settings, notifications },
            },
          };
        }),

      updatePreferences: (patch) => {
        if (patch.sfx !== undefined) void sfx.setEnabled(patch.sfx);
        update((previous) => ({
          ...previous,
          user: {
            ...previous.user,
            settings: {
              ...previous.user.settings,
              preferences: { ...previous.user.settings.preferences, ...patch },
            },
          },
        }));
      },

      sendMessage: (content, conversation, type = 'text', attachment) =>
        update((previous) => {
          feedback.tap(previous.user.settings.preferences.haptics);
          feedback.sound('send', previous.user.settings.preferences.sfx);

          const msgId = ensureUUID(newId());
          const currentSenderId = (session?.user?.id && isUUID(session.user.id)) ? session.user.id : previous.user.id;
          const message: Message = {
            id: msgId,
            workspaceId: previous.workspace?.id,
            conversationId: conversation,
            senderId: currentSenderId,
            senderName: previous.user.name,
            type,
            content,
            timestamp: stamp(),
            status: 'sent',
            ...attachment,
          };

          if (conversation === 'workspace' && previous.workspace?.id) {
            void supabaseRepo.insertMessage(message).then((res) => {
              if (!res.success) {
                console.warn('[AppContext] insertMessage failed:', res.error);
              }
            });
          }

          return { ...previous, messages: [...previous.messages, message] };
        }),

      addMeal: (meal) =>
        update((previous) => {
          const newMeal: Meal = {
            ...meal,
            id: newId(),
            ownerId: previous.user.id,
            date: previous.activeDay,
            workspaceId: meal.visibility === 'shared' ? previous.workspace?.id : undefined,
          };
          void supabaseRepo.insertMeal(newMeal);
          return { ...previous, meals: [...previous.meals, newMeal] };
        }),

      deleteMeal: (mealId) =>
        update((previous) => {
          void supabaseRepo.deleteMeal(mealId);
          return { ...previous, meals: previous.meals.filter((m) => m.id !== mealId) };
        }),

      updateMeal: (meal) =>
        update((previous) => {
          void supabaseRepo.updateMeal(meal);
          return {
            ...previous,
            meals: previous.meals.map((m) => (m.id === meal.id ? meal : m)),
          };
        }),

      uploadUserAvatar: async (localUri: string) => {
        const uid = session?.user?.id || state.user.id;
        const url = await supabaseRepo.uploadUserAvatar(uid, localUri);
        if (url) {
          update((p) => ({
            ...p,
            user: { ...p.user, avatar: url },
          }));
        }
        return url;
      },

      removeUserAvatar: async () => {
        const uid = session?.user?.id || state.user.id;
        const ok = await supabaseRepo.removeUserAvatar(uid);
        if (ok) {
          const fallback = state.user.name?.charAt(0)?.toUpperCase() || 'U';
          update((p) => ({
            ...p,
            user: { ...p.user, avatar: fallback },
          }));
        }
        return ok;
      },

      uploadWorkspaceAvatar: async (localUri: string) => {
        const wsId = state.workspace?.id;
        if (!wsId) return null;
        const url = await supabaseRepo.uploadWorkspaceAvatar(wsId, localUri);
        if (url) {
          await supabaseRepo.updateWorkspaceIdentity(wsId, undefined, url);
          update((p) => ({
            ...p,
            workspace: p.workspace ? { ...p.workspace, avatarUrl: url } : undefined,
          }));
        }
        return url;
      },

      updateWorkspaceIdentity: async (name?: string, avatarUrl?: string | null) => {
        const wsId = state.workspace?.id;
        if (!wsId) return false;
        const ok = await supabaseRepo.updateWorkspaceIdentity(wsId, name, avatarUrl);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace
              ? {
                  ...p.workspace,
                  name: name ?? p.workspace.name,
                  avatarUrl: avatarUrl === undefined ? p.workspace.avatarUrl : (avatarUrl ?? undefined),
                }
              : undefined,
          }));
        }
        return ok;
      },

      dailyRecap: () => ({
        date: state.activeDay,
        you: dailyPercent,
        shared: state.workspace ? sharedDailyPercent : undefined,
      }),

      // ----------------------------------------------------------------------
      // JOURNAL SECURITY & ENCRYPTED CONTENT
      // ----------------------------------------------------------------------
      unlockJournal: async (pin: string) => {
        try {
          const currentSec = state.journalSecurity;
          if (!currentSec) {
            return { success: false, error: 'Journal PIN has not been configured yet.' };
          }

          const res = await journalCrypto.verifyPin(pin, currentSec);
          if (!res.success) {
            if (res.updatedSecurity) {
              update((p) => ({ ...p, journalSecurity: res.updatedSecurity }));
              if (isUUID(state.user.id)) {
                void supabaseRepo.saveJournalSecurity(state.user.id, res.updatedSecurity);
              }
            }
            return { success: false, error: res.error || 'Incorrect PIN.' };
          }

          // Successfully verified: decrypt all valid entries into in-memory array
          const decrypted: { id: string; plaintext: string; timestamp: string; date: string }[] = [];
          for (const entry of state.journal || []) {
            if (!entry || !entry.id) continue;
            const entryDate = entry.date || evoryzDay();
            const entryTime = entry.timestamp || new Date().toISOString();
            if (!entry.encryptedContent || !entry.iv) {
              decrypted.push({
                id: entry.id,
                plaintext: '[Corrupted Entry — Missing ciphertext]',
                timestamp: entryTime,
                date: entryDate,
              });
              continue;
            }
            try {
              const pt = await journalCrypto.decrypt({
                ciphertext: entry.encryptedContent,
                iv: entry.iv,
                algorithm: entry.algorithm,
              });
              decrypted.push({
                id: entry.id,
                plaintext: pt,
                timestamp: entryTime,
                date: entryDate,
              });
            } catch {
              decrypted.push({
                id: entry.id,
                plaintext: '[Encrypted Entry — Key Mismatch]',
                timestamp: entryTime,
                date: entryDate,
              });
            }
          }

          setIsJournalUnlocked(true);
          setDecryptedEntries(decrypted);

          if (res.updatedSecurity) {
            update((p) => ({ ...p, journalSecurity: res.updatedSecurity }));
            if (isUUID(state.user.id)) {
              void supabaseRepo.saveJournalSecurity(state.user.id, res.updatedSecurity);
            }
          }

          return { success: true };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to unlock journal';
          return { success: false, error: msg };
        }
      },

      lockJournal: () => {
        journalCrypto.lock();
        setIsJournalUnlocked(false);
        setDecryptedEntries([]);
      },

      setupJournalPin: async (pin: string) => {
        const securityConfig = await journalCrypto.setupPin(pin);
        setIsJournalUnlocked(true);
        setDecryptedEntries([]);
        update((p) => ({ ...p, journalSecurity: securityConfig }));
        if (isUUID(state.user.id)) {
          void supabaseRepo.saveJournalSecurity(state.user.id, securityConfig);
        }
      },

      changeJournalPin: async (currentPin: string, newPin: string) => {
        if (!state.journalSecurity) {
          return { success: false, error: 'No PIN set.' };
        }

        const payloads: { id: string; payload: EncryptedPayload }[] = (state.journal || [])
          .filter((j) => j && j.id && j.encryptedContent && j.iv)
          .map((j) => ({
            id: j.id,
            payload: { ciphertext: j.encryptedContent, iv: j.iv, algorithm: j.algorithm },
          }));

        const result = await journalCrypto.changePin(currentPin, newPin, state.journalSecurity, payloads);
        if (!result.success || !result.updatedSecurity) {
          return { success: false, error: result.error || 'Failed to change PIN.' };
        }

        // Update entries with re-encrypted payloads
        if (result.reEncryptedPayloads) {
          const payloadMap = new Map(result.reEncryptedPayloads.map((r) => [r.id, r.payload]));
          update((p) => ({
            ...p,
            journalSecurity: result.updatedSecurity,
            journal: p.journal.map((j) => {
              const np = payloadMap.get(j.id);
              if (np) {
                if (isUUID(j.id)) {
                  void supabaseRepo.updateJournalEntry(j.id, np.ciphertext, np.iv);
                }
                return { ...j, encryptedContent: np.ciphertext, iv: np.iv };
              }
              return j;
            }),
          }));
        } else {
          update((p) => ({ ...p, journalSecurity: result.updatedSecurity }));
        }

        if (isUUID(state.user.id)) {
          void supabaseRepo.saveJournalSecurity(state.user.id, result.updatedSecurity);
        }
        return { success: true };
      },

      resetJournalPin: async (newPin: string) => {
        // Enforce active authenticated account session
        const currentSession = await authService.getSession();
        if (!currentSession?.user || currentSession.user.id === 'unauthenticated' || !currentSession.user.email) {
          throw new Error('Account authentication required. You must be signed in with your Google account to reset your journal PIN.');
        }

        const securityConfig = await journalCrypto.resetPinThroughAuth(newPin);
        setIsJournalUnlocked(true);
        setDecryptedEntries([]);
        update((p) => ({ ...p, journalSecurity: securityConfig }));
        await supabaseRepo.saveJournalSecurity(currentSession.user.id, securityConfig);
      },

      addJournalEntry: async (content: string) => {
        const todayDay = evoryzDay();
        const encPayload = await journalCrypto.encrypt(content);
        const newEntry: JournalEntry = {
          id: newId(),
          ownerId: state.user.id,
          encryptedContent: encPayload.ciphertext,
          iv: encPayload.iv,
          algorithm: encPayload.algorithm,
          date: todayDay,
          timestamp: stamp(),
        };

        if (isUUID(state.user.id)) {
          void supabaseRepo.insertJournalEntry(newEntry);
        }

        setDecryptedEntries((prev) => [
          ...prev,
          {
            id: newEntry.id,
            plaintext: content,
            timestamp: newEntry.timestamp,
            date: newEntry.date,
          },
        ]);

        update((p) => ({ ...p, journal: [...p.journal, newEntry] }));
      },

      deleteJournalEntry: async (id: string) => {
        if (isUUID(id)) {
          void supabaseRepo.deleteJournalEntry(id);
        }
        setDecryptedEntries((prev) => prev.filter((e) => e.id !== id));
        update((p) => ({ ...p, journal: p.journal.filter((j) => j.id !== id) }));
      },

      refreshWorkspaceMessages: async () => {
        const currentWsId = state.workspace?.id;
        if (!currentWsId || !isUUID(currentWsId)) return;
        try {
          const fetched = await supabaseRepo.fetchMessages('workspace', currentWsId);
          if (fetched.length > 0) {
            update((p) => ({ ...p, messages: fetched }));
          }
        } catch (err) {
          console.warn('[AppContext] refreshWorkspaceMessages error:', err);
        }
      },

      retryChatConnection: () => {
        setChatConnectionStatus('CONNECTING');
        setChatRetryTrigger((prev) => prev + 1);
      },

      isChatConnected: chatConnectionStatus === 'CONNECTED',
      chatConnectionStatus,

      // ----------------------------------------------------------------------
      // EVOLUTION 2.0 MASTER FEATURES
      // ----------------------------------------------------------------------
      changeTheme: async (theme: WorkspaceTheme) => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.setWorkspaceTheme(wsId, theme);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace ? { ...p.workspace, theme } : undefined,
          }));
        }
        return ok;
      },

      setMemberRole: async (targetUserId: string, role: 'admin' | 'member') => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId) || !isUUID(targetUserId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.setWorkspaceMemberRole(wsId, targetUserId, role);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace
              ? {
                  ...p.workspace,
                  members: p.workspace.members.map((m) => (m.id === targetUserId ? { ...m, role } : m)),
                }
              : undefined,
          }));
        }
        return ok;
      },

      setMemberMuted: async (targetUserId: string, isMuted: boolean) => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId) || !isUUID(targetUserId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.setWorkspaceMemberMuted(wsId, targetUserId, isMuted);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace
              ? {
                  ...p.workspace,
                  members: p.workspace.members.map((m) => (m.id === targetUserId ? { ...m, isMuted } : m)),
                }
              : undefined,
          }));
        }
        return ok;
      },

      removeMember: async (targetUserId: string) => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId) || !isUUID(targetUserId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.removeWorkspaceMember(wsId, targetUserId);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace
              ? {
                  ...p.workspace,
                  members: p.workspace.members.filter((m) => m.id !== targetUserId),
                }
              : undefined,
          }));
        }
        return ok;
      },

      toggleWorkspaceNotifications: async (muted: boolean) => {
        const wsId = state.workspace?.id;
        const uid = state.user.id;
        if (!wsId || !isUUID(wsId) || !isUUID(uid)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.toggleWorkspaceNotifications(wsId, muted);
        if (ok) {
          update((p) => ({
            ...p,
            workspace: p.workspace
              ? {
                  ...p.workspace,
                  members: p.workspace.members.map((m) =>
                    m.id === uid ? { ...m, notificationsMuted: muted } : m
                  ),
                }
              : undefined,
          }));
        }
        return ok;
      },

      togglePinMessage: async (messageId: string, isPinned: boolean) => {
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.togglePinMessage(messageId, isPinned);
        if (ok) {
          update((p) => ({
            ...p,
            messages: p.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    isPinned,
                    pinnedBy: isPinned ? state.user.id : undefined,
                    pinnedAt: isPinned ? stamp() : undefined,
                  }
                : m
            ),
          }));
        }
        return ok;
      },

      bookmarkMessage: async (messageId: string) => {
        const uid = state.user.id;
        if (!isUUID(uid)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.bookmarkMessage(uid, messageId);
        if (ok) {
          setSavedMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]));
        }
        return ok;
      },

      removeBookmark: async (messageId: string) => {
        const uid = state.user.id;
        if (!isUUID(uid)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.removeBookmark(uid, messageId);
        if (ok) {
          setSavedMessageIds((prev) => prev.filter((id) => id !== messageId));
        }
        return ok;
      },

      savedMessageIds,
      teamGoals,

      createTeamGoal: async (title: string, targetCount: number, unit?: string) => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        const newGoal = await supabaseRepo.createTeamGoal(wsId, title, targetCount, unit);
        if (newGoal) {
          setTeamGoals((prev) => [...prev, newGoal]);
          return true;
        }
        return false;
      },

      updateTeamGoal: async (goalId: string, currentCount: number) => {
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.updateTeamGoal(goalId, currentCount);
        if (ok) {
          setTeamGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, current: currentCount } : g)));
          return true;
        }
        return false;
      },

      deleteTeamGoal: async (goalId: string) => {
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.deleteTeamGoal(goalId);
        if (ok) {
          setTeamGoals((prev) => prev.filter((g) => g.id !== goalId));
        }
        return ok;
      },

      refreshTeamGoals: async () => {
        const wsId = state.workspace?.id;
        if (!wsId || !isUUID(wsId)) return;
        const goals = await supabaseRepo.fetchTeamGoals(wsId);
        setTeamGoals(goals);
      },

      directMessages,

      sendDirectMessage: async (
        recipientId: string,
        content: string,
        type: DirectMessage['type'] = 'text',
        attachment
      ) => {
        const uid = state.user.id;
        if (!isUUID(uid) || !isUUID(recipientId)) return false;
        feedback.tap(state.user.settings.preferences.haptics);
        feedback.sound('send', state.user.settings.preferences.sfx);

        const convId = [uid, recipientId].sort().join('_');
        const newDm: DirectMessage = {
          id: generateUUID(),
          conversationId: convId,
          senderId: uid,
          recipientId,
          senderName: state.user.name,
          senderAvatar: state.user.avatar,
          content,
          type,
          attachmentUrl: attachment?.attachmentUrl,
          thumbnailUrl: attachment?.thumbnailUrl,
          createdAt: stamp(),
        };

        setDirectMessages((prev) => [...prev, newDm]);
        const res = await supabaseRepo.sendDirectMessage(newDm);
        return Boolean(res.success);
      },

      deleteDirectMessage: async (messageId: string) => {
        feedback.tap(state.user.settings.preferences.haptics);
        const ok = await supabaseRepo.deleteDirectMessage(messageId);
        if (ok) {
          setDirectMessages((prev) => prev.filter((d) => d.id !== messageId));
        }
        return ok;
      },

      fetchDirectMessages: async (peerId: string) => {
        const uid = state.user.id;
        if (!isUUID(uid) || !isUUID(peerId)) return [];
        const msgs = await supabaseRepo.fetchDirectMessages(uid, peerId);
        setDirectMessages((prev) => {
          const map = new Map<string, DirectMessage>();
          prev.forEach((m) => map.set(m.id, m));
          msgs.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        return msgs;
      },

      searchUsers: async (query: string) => {
        return supabaseRepo.searchUsersByUsername(query);
      },

      deleteUserAccount: async () => {
        const uid = state.user.id;
        if (!isUUID(uid)) return false;
        const res = await supabaseRepo.deleteUserAccount();
        if (res.success) {
          await authService.signOut();
          journalCrypto.lock();
          setIsJournalUnlocked(false);
          setDecryptedEntries([]);
          setState(initial('unauthenticated'));
          await AsyncStorage.removeItem(storageKey);
          return true;
        }
        return false;
      },

      exportUserData: async () => {
        const uid = state.user.id;
        if (!isUUID(uid)) return null;
        const data = await supabaseRepo.exportUserData(uid);
        return data ? JSON.stringify(data, null, 2) : null;
      },

      isOnline,
    };
  }, [
    state,
    session,
    hydrated,
    isJournalUnlocked,
    decryptedEntries,
    chatConnectionStatus,
    savedMessageIds,
    teamGoals,
    directMessages,
    isOnline,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
