import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SfxName =
  | 'tap'
  | 'send'
  | 'messageReceived'
  | 'taskComplete'
  | 'habitComplete'
  | 'goalComplete'
  | 'streakMilestone'
  | 'workspaceConnected'
  | 'error'
  | 'success'
  | 'notification'
  | 'ping';

const preferenceKey = 'evoryz.sfx.enabled';

const files: Record<SfxName, string> = {
  tap: 'tap.mp3',
  send: 'send.mp3',
  messageReceived: 'message-received.mp3',
  taskComplete: 'task-complete.mp3',
  habitComplete: 'habit-complete.mp3',
  goalComplete: 'goal-complete.mp3',
  streakMilestone: 'streak-milestone.mp3',
  workspaceConnected: 'workspace-connected.mp3',
  error: 'error.mp3',
  success: 'success.mp3',
  notification: 'notification.mp3',
  ping: 'notification.mp3',
};

export const ALL_SFX_LIST: { id: SfxName; name: string; file: string }[] = [
  { id: 'tap', name: 'Tap / Button Click', file: 'tap.mp3' },
  { id: 'send', name: 'Message Sent', file: 'send.mp3' },
  { id: 'messageReceived', name: 'Message Received', file: 'message-received.mp3' },
  { id: 'taskComplete', name: 'Task Completed', file: 'task-complete.mp3' },
  { id: 'habitComplete', name: 'Habit Completed', file: 'habit-complete.mp3' },
  { id: 'goalComplete', name: 'Goal Completed', file: 'goal-complete.mp3' },
  { id: 'streakMilestone', name: 'Streak Milestone', file: 'streak-milestone.mp3' },
  { id: 'workspaceConnected', name: 'Workspace Connected', file: 'workspace-connected.mp3' },
  { id: 'success', name: 'Success Confirmation', file: 'success.mp3' },
  { id: 'error', name: 'Error Alert', file: 'error.mp3' },
  { id: 'notification', name: 'Notification Chime', file: 'notification.mp3' },
  { id: 'ping', name: 'Teammate Ping Sound', file: 'notification.mp3' },
];

const bundledAssets: Record<SfxName, any> = {
  tap: require('@/assets/sfx/tap.mp3'),
  send: require('@/assets/sfx/send.mp3'),
  messageReceived: require('@/assets/sfx/message-received.mp3'),
  taskComplete: require('@/assets/sfx/task-complete.mp3'),
  habitComplete: require('@/assets/sfx/habit-complete.mp3'),
  goalComplete: require('@/assets/sfx/goal-complete.mp3'),
  streakMilestone: require('@/assets/sfx/streak-milestone.mp3'),
  workspaceConnected: require('@/assets/sfx/workspace-connected.mp3'),
  error: require('@/assets/sfx/error.mp3'),
  success: require('@/assets/sfx/success.mp3'),
  notification: require('@/assets/sfx/notification.mp3'),
  ping: require('@/assets/sfx/notification.mp3'),
};

class SfxService {
  private enabled = true;
  private volume = 1.0;
  private players = new Map<SfxName, AudioPlayer>();
  private recent = new Map<SfxName, number>();
  private preloaded = false;

  async hydrate() {
    this.enabled = (await AsyncStorage.getItem(preferenceKey)) !== 'false';
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
      if (!this.preloaded) {
        const assetList = Object.values(bundledAssets);
        await Asset.loadAsync(assetList);
        this.preloaded = true;
      }
    } catch (err) {
      console.warn('[SfxService] Preload warning:', err);
    }
  }

  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    await AsyncStorage.setItem(preferenceKey, String(enabled));
    if (!enabled) this.stopAll();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  expectedFile(name: SfxName) {
    return files[name];
  }

  async play(name: SfxName) {
    if (!this.enabled || bundledAssets[name] === undefined) return;
    const now = Date.now();
    const debounceTime = name === 'ping' ? 600 : 80;
    if (now - (this.recent.get(name) ?? 0) < debounceTime) return;
    this.recent.set(name, now);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
      let player = this.players.get(name);
      if (!player) {
        player = createAudioPlayer(bundledAssets[name]);
        this.players.set(name, player);
      }
      player.volume = this.volume;
      try {
        await player.seekTo(0);
      } catch {}
      player.play();
    } catch (err) {
      console.warn(`[SfxService] Playback warning on ${name}:`, err);
    }
  }

  stopAll() {
    this.players.forEach((player) => player.pause());
  }

  dispose() {
    this.players.forEach((player) => player.remove());
    this.players.clear();
  }
}

export const sfx = new SfxService();
