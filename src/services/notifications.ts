import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings } from '@/src/types';
import { getNext2amBoundaryDate, evoryzDay } from './evoryzDay';

// Stable Notification Channel Identifiers for Android 8.0+
export const DAILY_2AM_CHANNEL_ID = 'evoryz-daily-2am';
export const PING_CHANNEL_ID = 'evoryz-ping-channel';
export const CHAT_CHANNEL_ID = 'evoryz-chat-channel';
export const WINTER_ARC_CHANNEL_ID = 'evoryz-winter-arc';

// Stable Notification Request Identifiers
export const DAILY_2AM_NOTIFICATION_ID = 'evoryz-daily-2am-boundary';
export const WINTER_ARC_MORNING_ID = 'winter-arc-morning';
export const WINTER_ARC_AFTERNOON_ID = 'winter-arc-afternoon';
export const WINTER_ARC_EVENING_ID = 'winter-arc-evening';
export const WINTER_ARC_LATE_ID = 'winter-arc-late';

// Winter Arc Lock-In Checkpoints (Exact 6 daily times in device local time)
export const WINTER_ARC_LOCKIN_0630_ID = 'winter-arc-lockin-0630';
export const WINTER_ARC_LOCKIN_0900_ID = 'winter-arc-lockin-0900';
export const WINTER_ARC_LOCKIN_1100_ID = 'winter-arc-lockin-1100';
export const WINTER_ARC_LOCKIN_1600_ID = 'winter-arc-lockin-1600';
export const WINTER_ARC_LOCKIN_2000_ID = 'winter-arc-lockin-2000';
export const WINTER_ARC_LOCKIN_2200_ID = 'winter-arc-lockin-2200';

export const ALL_WINTER_ARC_NOTIFICATION_IDS = [
  WINTER_ARC_MORNING_ID,
  WINTER_ARC_AFTERNOON_ID,
  WINTER_ARC_EVENING_ID,
  WINTER_ARC_LATE_ID,
  WINTER_ARC_LOCKIN_0630_ID,
  WINTER_ARC_LOCKIN_0900_ID,
  WINTER_ARC_LOCKIN_1100_ID,
  WINTER_ARC_LOCKIN_1600_ID,
  WINTER_ARC_LOCKIN_2000_ID,
  WINTER_ARC_LOCKIN_2200_ID,
];

// Set up notification handler for foreground notifications
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch {
  // Graceful fallback for non-native / test environments
}

let channelsInitialized = false;

// Bundled custom notification sound registered in app.json and res/raw/notification.mp3
export const EVORYZ_NOTIFICATION_SOUND = 'notification.mp3';

/**
 * Ensures required Android notification channels are registered with correct sound & priorities.
 */
export async function initNotificationChannelsAsync(): Promise<void> {
  if (channelsInitialized || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(DAILY_2AM_CHANNEL_ID, {
      name: 'Daily 2 AM Day Boundary',
      description: 'EvoRyz daily day boundary alerts to review and reset progress',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: EVORYZ_NOTIFICATION_SOUND,
      enableVibrate: true,
    });

    // Clean up legacy Ping channel if present on device so DND/bypassDnd is completely revoked
    if (typeof Notifications.deleteNotificationChannelAsync === 'function') {
      await Notifications.deleteNotificationChannelAsync(PING_CHANNEL_ID).catch(() => {});
    }

    await Notifications.setNotificationChannelAsync(CHAT_CHANNEL_ID, {
      name: 'Team Chat',
      description: 'Shared workspace messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 200],
      lightColor: '#7C3AED',
      sound: EVORYZ_NOTIFICATION_SOUND,
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync(WINTER_ARC_CHANNEL_ID, {
      name: 'Winter Arc Checkpoints',
      description: 'Winter Arc seasonal lock-in reminders and progress checks',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
      sound: EVORYZ_NOTIFICATION_SOUND,
      enableVibrate: true,
    });

    channelsInitialized = true;
  } catch (err) {
    console.warn('[Notifications] initNotificationChannelsAsync error:', err);
  }
}

export interface NotificationScheduler {
  sync(settings: NotificationSettings): Promise<void>;
  cancelAll(): Promise<void>;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[Notifications] requestNotificationPermission error:', err);
    return false;
  }
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await initNotificationChannelsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 EvoRyz Test Notification',
        body: 'Notifications are active and configured correctly.',
        sound: EVORYZ_NOTIFICATION_SOUND,
      },
      trigger: {
        channelId: DAILY_2AM_CHANNEL_ID,
      } as any,
    });
    return true;
  } catch (err) {
    console.warn('[Notifications] sendTestNotification error:', err);
    return false;
  }
}

/**
 * Schedules the OS-level recurring Daily 2:00 AM notification.
 * Uses centralized EvoRyz day-boundary logic (02:00 local device time).
 * Runs independently of app launch.
 */
export async function scheduleDaily2amNotification(settings?: NotificationSettings): Promise<boolean> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await initNotificationChannelsAsync();

    if (settings && (!settings.enabled || !settings.recapReminder)) {
      await Notifications.cancelScheduledNotificationAsync(DAILY_2AM_NOTIFICATION_ID).catch(() => undefined);
      return false;
    }

    // Cancel existing 2 AM scheduled notification to prevent duplicates
    await Notifications.cancelScheduledNotificationAsync(DAILY_2AM_NOTIFICATION_ID).catch(() => undefined);

    const next2am = getNext2amBoundaryDate();
    const nextDayStr = evoryzDay(next2am);

    // Schedule with OS native daily recurring trigger at 2:00 AM local device time
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_2AM_NOTIFICATION_ID,
      content: {
        title: '🌙 EvoRyz Day Boundary',
        body: '2:00 AM — New EvoRyz day begins. Review your daily progress and reset for today.',
        sound: EVORYZ_NOTIFICATION_SOUND,
        data: {
          type: 'daily_2am_boundary',
          scheduledFor: next2am.toISOString(),
          targetDay: nextDayStr,
          channelId: DAILY_2AM_CHANNEL_ID,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 2,
        minute: 0,
        channelId: DAILY_2AM_CHANNEL_ID,
      },
    });

    return true;
  } catch (err) {
    console.warn('[Notifications] scheduleDaily2amNotification error:', err);
    return false;
  }
}

export const DEV_TEST_DAILY_2AM_ID = 'evoryz-dev-test-2am';

/**
 * Dev-only test helper to verify OS-level notification delivery when backgrounded or locked.
 * Schedules a test 2 AM boundary notification `secondsFromNow` seconds in the future (default 120s / 2min).
 */
export async function scheduleDevTest2amNotification(secondsFromNow = 120): Promise<boolean> {
  const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
  if (!isDev) {
    console.warn('[Notifications] scheduleDevTest2amNotification is dev-only and disabled in production.');
    return false;
  }
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await initNotificationChannelsAsync();

    // Cancel any previous test notification
    await Notifications.cancelScheduledNotificationAsync(DEV_TEST_DAILY_2AM_ID).catch(() => undefined);

    const triggerDate = new Date(Date.now() + secondsFromNow * 1000);

    await Notifications.scheduleNotificationAsync({
      identifier: DEV_TEST_DAILY_2AM_ID,
      content: {
        title: '🌙 EvoRyz Day Boundary (TEST)',
        body: `2:00 AM Test: Day boundary fired on schedule (${secondsFromNow}s test delay). Reset and lock in!`,
        sound: EVORYZ_NOTIFICATION_SOUND,
        data: {
          type: 'daily_2am_boundary_test',
          scheduledFor: triggerDate.toISOString(),
          channelId: DAILY_2AM_CHANNEL_ID,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        repeats: false,
        channelId: DAILY_2AM_CHANNEL_ID,
      },
    });

    return true;
  } catch (err) {
    console.warn('[Notifications] scheduleDevTest2amNotification error:', err);
    return false;
  }
}

const recentNotificationIds = new Set<string>();

export async function sendPeerMessageNotification(params: {
  messageId: string;
  senderName: string;
  messageType: string;
}): Promise<void> {
  const { messageId, senderName, messageType } = params;
  if (!messageId || recentNotificationIds.has(messageId)) {
    return;
  }
  recentNotificationIds.add(messageId);
  if (recentNotificationIds.size > 100) {
    const first = recentNotificationIds.values().next().value;
    if (first) recentNotificationIds.delete(first);
  }

  // CRITICAL PRIVACY: NEVER expose actual message content in notifications
  let bodyText = `${senderName} sent a new message`;
  if (messageType === 'image') {
    bodyText = `${senderName} sent a photo`;
  } else if (messageType === 'video') {
    bodyText = `${senderName} sent a video`;
  } else if (messageType === 'voice') {
    bodyText = `${senderName} sent a voice message`;
  } else if (messageType === 'file') {
    bodyText = `${senderName} sent an attachment`;
  }

  try {
    await initNotificationChannelsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'EvoRyz Team Chat',
        body: bodyText,
        sound: EVORYZ_NOTIFICATION_SOUND,
      },
      trigger: {
        channelId: CHAT_CHANNEL_ID,
      } as any,
    });
  } catch (err) {
    console.warn('[Notifications] sendPeerMessageNotification error:', err);
  }
}

/**
 * @deprecated Ping is strictly an in-app realtime sound event, not an Android notification.
 */
export async function sendPingNotification(_params: { senderName: string } | string): Promise<void> {
  // Pings are strictly in-app realtime audio events per user requirements.
  return Promise.resolve();
}

/**
 * Configurable Winter Arc Checkpoints.
 * Levels:
 * - 'light': Morning kick-off (08:00 AM)
 * - 'normal': Morning (08:00 AM) + Evening check-in (08:00 PM)
 * - 'lock_in': Exactly 6 daily checkpoints in device local time:
 *   06:30 (Wake Up), 09:00, 11:00, 16:00, 20:00, 22:00 (Sleep)
 */
export async function scheduleWinterArcNotifications(
  level: 'light' | 'normal' | 'lock_in',
  settings?: NotificationSettings
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted || (settings && !settings.enabled)) {
      await cancelWinterArcNotifications();
      return;
    }

    await initNotificationChannelsAsync();
    // Cancel/replace all prior Winter Arc schedules cleanly to prevent duplicates
    await cancelWinterArcNotifications();

    if (level === 'light') {
      // Light Mode: Morning 08:00 AM only
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_MORNING_ID,
        content: {
          title: '❄️ WINTER ARC 2026',
          body: "Today's lock-in starts now. Build your streak.",
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });
    } else if (level === 'normal') {
      // Normal Mode: Morning 08:00 AM + Evening 08:00 PM (20:00)
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_MORNING_ID,
        content: {
          title: '❄️ WINTER ARC 2026',
          body: "Today's lock-in starts now. Build your streak.",
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_EVENING_ID,
        content: {
          title: '🔥 Arc Check-in',
          body: 'Check your Winter Arc tracker. Finish what you started today.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });
    } else if (level === 'lock_in') {
      // Lock-In Mode: Exactly six daily checkpoints
      // 1. 06:30 — Wake Up
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_0630_ID,
        content: {
          title: '❄️ Winter Arc — Wake Up & Rise',
          body: '06:30 — Wake up. Your day starts now. Outwork yesterday.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 6,
          minute: 30,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      // 2. 09:00
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_0900_ID,
        content: {
          title: '⚡ Winter Arc — Morning Focus',
          body: '09:00 — Deep work block underway. Execute your highest leverage habits.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 9,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      // 3. 11:00
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_1100_ID,
        content: {
          title: '🔥 Winter Arc — Midday Momentum',
          body: '11:00 — Maintain discipline. Check off morning progress and stay locked in.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 11,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      // 4. 16:00
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_1600_ID,
        content: {
          title: '⚔️ Winter Arc — Afternoon Drive',
          body: '16:00 — Push through the afternoon lull. Don’t leave your goals unfinished.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 16,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      // 5. 20:00
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_2000_ID,
        content: {
          title: '🛡️ Winter Arc — Evening Accountability',
          body: '20:00 — Final habit review. Close remaining tasks before the 2 AM boundary.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });

      // 6. 22:00 — Sleep
      await Notifications.scheduleNotificationAsync({
        identifier: WINTER_ARC_LOCKIN_2200_ID,
        content: {
          title: '🌙 Winter Arc — Wind Down & Sleep',
          body: '22:00 — Sleep & recover. Shut down screens. Rest is part of the lock-in.',
          sound: EVORYZ_NOTIFICATION_SOUND,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 22,
          minute: 0,
          channelId: WINTER_ARC_CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn('[Notifications] scheduleWinterArcNotifications error:', err);
  }
}

export async function cancelWinterArcNotifications(): Promise<void> {
  await Promise.all(
    ALL_WINTER_ARC_NOTIFICATION_IDS.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
}

const LAST_RECAP_KEY = 'evoryz.last_recap_day';

export async function triggerDailyRecapNotification(stats: {
  day: string;
  tasksCompleted: number;
  totalTasks: number;
  habitsCompleted: number;
  totalHabits: number;
  mealsCount: number;
  overallPercent: number;
}): Promise<boolean> {
  try {
    const lastDay = await AsyncStorage.getItem(LAST_RECAP_KEY);
    if (lastDay === stats.day) {
      return false; // Prevent duplicate recap notification for same completed day
    }

    const taskPct = stats.totalTasks > 0 ? Math.round((stats.tasksCompleted / stats.totalTasks) * 100) : 0;
    const habitPct = stats.totalHabits > 0 ? Math.round((stats.habitsCompleted / stats.totalHabits) * 100) : 0;

    await initNotificationChannelsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 EvoRyz Daily Recap',
        body: `Day Complete: ${stats.overallPercent}% overall · Tasks: ${taskPct}% · Habits: ${habitPct}% · ${stats.mealsCount} meal${stats.mealsCount === 1 ? '' : 's'}. Keep evolving.`,
        sound: EVORYZ_NOTIFICATION_SOUND,
      },
      trigger: {
        channelId: DAILY_2AM_CHANNEL_ID,
      } as any,
    });

    await AsyncStorage.setItem(LAST_RECAP_KEY, stats.day);
    return true;
  } catch (err) {
    console.warn('[Notifications] triggerDailyRecapNotification error:', err);
    return false;
  }
}

export const localNotificationScheduler: NotificationScheduler = {
  async sync(settings: NotificationSettings) {
    try {
      if (!settings.enabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        return;
      }
      await requestNotificationPermission();
      await initNotificationChannelsAsync();
      await scheduleDaily2amNotification(settings);
    } catch (err) {
      console.warn('[Notifications] sync error:', err);
    }
  },
  async cancelAll() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.warn('[Notifications] cancelAll error:', err);
    }
  },
};
