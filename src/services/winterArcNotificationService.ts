import * as Notifications from 'expo-notifications';
import {
  initNotificationChannelsAsync,
  requestNotificationPermission,
  WINTER_ARC_CHANNEL_ID,
  EVORYZ_NOTIFICATION_SOUND,
} from './notifications';
import { WinterArcMilestone, WinterArcWeeklyRecap } from '@/src/types/winterArc';

export const WinterArcNotificationService = {
  /**
   * Fires a high-impact notification when a Winter Arc milestone is achieved.
   */
  async notifyMilestoneAchieved(milestone: WinterArcMilestone): Promise<boolean> {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      await initNotificationChannelsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🏆 Winter Arc Milestone: ${milestone.title}`,
          body: `Day ${milestone.dayNumber} conquered! ${milestone.description}`,
          sound: EVORYZ_NOTIFICATION_SOUND,
          data: {
            type: 'winter_arc_milestone',
            milestoneKey: milestone.milestoneKey,
            channelId: WINTER_ARC_CHANNEL_ID,
          },
        },
        trigger: {
          channelId: WINTER_ARC_CHANNEL_ID,
        } as any,
      });

      return true;
    } catch (err) {
      console.warn('[WinterArcNotificationService] notifyMilestoneAchieved error:', err);
      return false;
    }
  },

  /**
   * Fires an evening streak risk alert if the daily score is below passing.
   */
  async notifyStreakRisk(currentStreak: number, remainingRulesCount: number): Promise<boolean> {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      await initNotificationChannelsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Winter Arc Streak At Risk',
          body: `You have ${remainingRulesCount} rules left to lock in today! Don't break your ${currentStreak}-day streak.`,
          sound: EVORYZ_NOTIFICATION_SOUND,
          data: {
            type: 'winter_arc_streak_risk',
            channelId: WINTER_ARC_CHANNEL_ID,
          },
        },
        trigger: {
          channelId: WINTER_ARC_CHANNEL_ID,
        } as any,
      });

      return true;
    } catch (err) {
      console.warn('[WinterArcNotificationService] notifyStreakRisk error:', err);
      return false;
    }
  },

  /**
   * Fires a notification when a new 7-day weekly recap is ready.
   */
  async notifyWeeklyRecapAvailable(recap: WinterArcWeeklyRecap): Promise<boolean> {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      await initNotificationChannelsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📊 Winter Arc Week ${recap.weekNumber} Recap Ready`,
          body: `Weekly score: ${recap.weeklyScore}%. Strongest habit: ${recap.strongestRuleTitle}. Review your progress now.`,
          sound: EVORYZ_NOTIFICATION_SOUND,
          data: {
            type: 'winter_arc_weekly_recap',
            weekNumber: recap.weekNumber,
            channelId: WINTER_ARC_CHANNEL_ID,
          },
        },
        trigger: {
          channelId: WINTER_ARC_CHANNEL_ID,
        } as any,
      });

      return true;
    } catch (err) {
      console.warn('[WinterArcNotificationService] notifyWeeklyRecapAvailable error:', err);
      return false;
    }
  },

  /**
   * Fires the grand finale notification upon Arc completion.
   */
  async notifyArcCompletion(totalDays: number, finalScore: number): Promise<boolean> {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      await initNotificationChannelsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '❄️ WINTER ARC CONQUERED! ❄️',
          body: `You completed all ${totalDays} days with a ${finalScore}% overall execution rate! Check your final victory recap card.`,
          sound: EVORYZ_NOTIFICATION_SOUND,
          data: {
            type: 'winter_arc_completion',
            channelId: WINTER_ARC_CHANNEL_ID,
          },
        },
        trigger: {
          channelId: WINTER_ARC_CHANNEL_ID,
        } as any,
      });

      return true;
    } catch (err) {
      console.warn('[WinterArcNotificationService] notifyArcCompletion error:', err);
      return false;
    }
  },
};
