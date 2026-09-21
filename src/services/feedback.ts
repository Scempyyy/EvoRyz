import * as Haptics from 'expo-haptics';
import { sfx, type SfxName } from './sfx';

export const feedback = {
  tap(enabled = true) { if (enabled) Haptics.selectionAsync().catch(() => undefined); },
  success(enabled = true) { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
  impact(enabled = true) { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); },
  sound(name: SfxName, enabled = true) { if (enabled) void sfx.play(name); },
};
