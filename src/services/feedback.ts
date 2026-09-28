import * as Haptics from 'expo-haptics';
import { sfx, type SfxName } from './sfx';

export const feedback = {
  tap(enabled = true) {
    if (enabled) Haptics.selectionAsync().catch(() => undefined);
  },
  success(enabled = true) {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  error(enabled = true) {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
  warning(enabled = true) {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
  impact(enabled = true) {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light', enabled = true) {
    if (!enabled) return;
    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    else if (type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    else if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  sound(name: SfxName, enabled = true) {
    if (enabled) void sfx.play(name);
  },
};
