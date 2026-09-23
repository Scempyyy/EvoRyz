import AsyncStorage from '@react-native-async-storage/async-storage';
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
  | 'notification';

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
};

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
};

class SfxService {
  private enabled = true;
  private volume = 0.55;
  private players = new Map<SfxName, AudioPlayer>();
  private recent = new Map<SfxName, number>();

  async hydrate() {
    this.enabled = (await AsyncStorage.getItem(preferenceKey)) !== 'false';
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
    if (now - (this.recent.get(name) ?? 0) < 90) return;
    this.recent.set(name, now);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
      let player = this.players.get(name);
      if (!player) {
        player = createAudioPlayer(bundledAssets[name]);
        this.players.set(name, player);
      }
      player.volume = this.volume;
      player.currentTime = 0;
      player.play();
    } catch {
      /* Missing/corrupt optional SFX is always non-fatal. */
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
