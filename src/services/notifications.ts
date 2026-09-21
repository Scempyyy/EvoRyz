import { NotificationSettings } from '@/src/types';

/**
 * Boundary for native notifications. This V1 deliberately records intent only;
 * an Expo Notifications adapter can implement this contract without changing UI
 * or application state when native permission/scheduling is introduced.
 */
export interface NotificationScheduler {
  sync(settings: NotificationSettings): Promise<void>;
  cancelAll(): Promise<void>;
}

export const localNotificationScheduler: NotificationScheduler = {
  async sync(_settings) { /* Local/mock implementation: no OS notification permission is requested. */ },
  async cancelAll() { /* Local/mock implementation. */ },
};
