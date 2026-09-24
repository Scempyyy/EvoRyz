import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings } from '@/src/types';

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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 EvoRyz Test Notification',
        body: 'Notifications are active and configured correctly.',
        sound: true,
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('[Notifications] sendTestNotification error:', err);
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

  // CRITICAL REQUIREMENT: NEVER expose actual message content in notifications
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'EvoRyz Team Chat',
        body: bodyText,
        sound: true,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notifications] sendPeerMessageNotification error:', err);
  }
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 EvoRyz Daily Recap',
        body: `Day Complete: ${stats.overallPercent}% overall · Tasks: ${taskPct}% · Habits: ${habitPct}% · ${stats.mealsCount} meal${stats.mealsCount === 1 ? '' : 's'}. Keep evolving.`,
        sound: true,
      },
      trigger: null,
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
