import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DAILY_2AM_CHANNEL_ID,
  PING_CHANNEL_ID,
  CHAT_CHANNEL_ID,
  WINTER_ARC_CHANNEL_ID,
  DAILY_2AM_NOTIFICATION_ID,
  scheduleDaily2amNotification,
  sendPingNotification,
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
  ALL_WINTER_ARC_NOTIFICATION_IDS,
  scheduleWinterArcNotifications,
  cancelWinterArcNotifications,
  triggerDailyRecapNotification,
  scheduleDevTest2amNotification,
  DEV_TEST_DAILY_2AM_ID,
  EVORYZ_NOTIFICATION_SOUND,
} from '@/src/services/notifications';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
  };
});

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
    NONE: 0,
    UNSPECIFIED: -1000,
  },
  AndroidNotificationPriority: {
    MAX: 'max',
    HIGH: 'high',
    DEFAULT: 'default',
    LOW: 'low',
    MIN: 'min',
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    CALENDAR: 'calendar',
    TIME_INTERVAL: 'timeInterval',
  },
}));

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines the correct Android notification channels', () => {
    expect(DAILY_2AM_CHANNEL_ID).toBe('evoryz-daily-2am');
    expect(PING_CHANNEL_ID).toBe('evoryz-ping-channel');
    expect(CHAT_CHANNEL_ID).toBe('evoryz-chat-channel');
    expect(WINTER_ARC_CHANNEL_ID).toBe('evoryz-winter-arc');
  });

  describe('scheduleDaily2amNotification', () => {
    it('cancels any prior schedule and schedules with DAILY trigger at hour 2', async () => {
      const result = await scheduleDaily2amNotification({
        enabled: true,
        recapReminder: true,
        morningBrief: true,
        streakSaver: true,
      });

      expect(result).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DAILY_2AM_NOTIFICATION_ID);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: DAILY_2AM_NOTIFICATION_ID,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 2,
            minute: 0,
            channelId: DAILY_2AM_CHANNEL_ID,
          }),
        })
      );
    });

    it('schedules dev test notification with time interval trigger', async () => {
      const result = await scheduleDevTest2amNotification(120);

      expect(result).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DEV_TEST_DAILY_2AM_ID);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: DEV_TEST_DAILY_2AM_ID,
          content: expect.objectContaining({
            title: expect.stringContaining('Day Boundary'),
          }),
          trigger: expect.objectContaining({
            type: 'timeInterval',
            seconds: 120,
            repeats: false,
            channelId: DAILY_2AM_CHANNEL_ID,
          }),
        })
      );
    });

    it('cancels scheduled notification if settings disabled', async () => {
      const result = await scheduleDaily2amNotification({
        enabled: false,
        recapReminder: false,
        morningBrief: false,
        streakSaver: false,
      });

      expect(result).toBe(false);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DAILY_2AM_NOTIFICATION_ID);
    });
  });

  describe('sendPingNotification', () => {
    it('does not schedule an Android notification for ping (strictly in-app sound)', async () => {
      await sendPingNotification('Alex');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Winter Arc Notifications', () => {
    it('schedules morning checkpoint on light level', async () => {
      await scheduleWinterArcNotifications('light');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_MORNING_ID,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 8,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );
    });

    it('schedules morning and evening checkpoints on normal level', async () => {
      await scheduleWinterArcNotifications('normal');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_MORNING_ID,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 8,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_EVENING_ID,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 20,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );
    });

    it('schedules exact six daily checkpoints on lock_in level with wake up and sleep messages', async () => {
      await scheduleWinterArcNotifications('lock_in');

      // 1. 06:30 — Wake Up
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_0630_ID,
          content: expect.objectContaining({
            title: expect.stringMatching(/Wake Up/i),
            body: expect.stringContaining('06:30'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 6,
            minute: 30,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // 2. 09:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_0900_ID,
          content: expect.objectContaining({
            body: expect.stringContaining('09:00'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 9,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // 3. 11:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_1100_ID,
          content: expect.objectContaining({
            body: expect.stringContaining('11:00'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 11,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // 4. 16:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_1600_ID,
          content: expect.objectContaining({
            body: expect.stringContaining('16:00'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 16,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // 5. 20:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_2000_ID,
          content: expect.objectContaining({
            body: expect.stringContaining('20:00'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 20,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // 6. 22:00 — Sleep
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: WINTER_ARC_LOCKIN_2200_ID,
          content: expect.objectContaining({
            title: expect.stringMatching(/Sleep/i),
            body: expect.stringContaining('22:00'),
            sound: EVORYZ_NOTIFICATION_SOUND,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 22,
            minute: 0,
            channelId: WINTER_ARC_CHANNEL_ID,
          }),
        })
      );

      // No old Lock-In times should be scheduled in lock_in mode
      const scheduledCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const scheduledIds = scheduledCalls.map((c: any) => c[0]?.identifier);
      expect(scheduledIds).not.toContain(WINTER_ARC_AFTERNOON_ID); // 14:00 old
      expect(scheduledIds).not.toContain(WINTER_ARC_LATE_ID); // 01:00 old
      expect(scheduledIds).not.toContain(WINTER_ARC_MORNING_ID); // 08:00 old
    });

    it('cancels all Winter Arc scheduled notifications including all Lock-In and legacy IDs', async () => {
      await cancelWinterArcNotifications();

      for (const id of ALL_WINTER_ARC_NOTIFICATION_IDS) {
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(id);
      }
    });

    it('prevents duplicate schedules when rescheduled or reopened', async () => {
      jest.clearAllMocks();
      await scheduleWinterArcNotifications('lock_in');
      const firstCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;
      expect(firstCalls).toBe(6);

      // Reschedule again
      await scheduleWinterArcNotifications('lock_in');
      // Verify cancel was called for every ID prior to rescheduling
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(WINTER_ARC_LOCKIN_0630_ID);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(WINTER_ARC_LOCKIN_2200_ID);
    });
  });

  describe('triggerDailyRecapNotification', () => {
    it('does not send duplicate recap for the same day', async () => {
      await AsyncStorage.setItem('evoryz.last_recap_day', '2026-10-01');

      const result = await triggerDailyRecapNotification({
        day: '2026-10-01',
        tasksCompleted: 4,
        totalTasks: 5,
        habitsCompleted: 3,
        totalHabits: 3,
        mealsCount: 2,
        overallPercent: 88,
      });

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules recap when it is a new completed day', async () => {
      await AsyncStorage.removeItem('evoryz.last_recap_day');

      const result = await triggerDailyRecapNotification({
        day: '2026-10-02',
        tasksCompleted: 5,
        totalTasks: 5,
        habitsCompleted: 3,
        totalHabits: 3,
        mealsCount: 3,
        overallPercent: 100,
      });

      expect(result).toBe(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '🌙 EvoRyz Daily Recap',
          }),
          trigger: expect.objectContaining({
            channelId: DAILY_2AM_CHANNEL_ID,
          }),
        })
      );
    });
  });
});
