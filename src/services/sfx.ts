import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SfxName = 'tap'|'send'|'messageReceived'|'taskComplete'|'habitComplete'|'goalComplete'|'streakMilestone'|'workspaceConnected'|'error'|'success'|'notification';
const preferenceKey = 'evoryz.sfx.enabled';
const files: Record<SfxName, string> = {
  tap: 'tap.mp3', send: 'send.mp3', messageReceived: 'message-received.mp3', taskComplete: 'task-complete.mp3', habitComplete: 'habit-complete.mp3', goalComplete: 'goal-complete.mp3', streakMilestone: 'streak-milestone.mp3', workspaceConnected: 'workspace-connected.mp3', error: 'error.mp3', success: 'success.mp3', notification: 'notification.mp3',
};
/**
 * Asset seam: app code only ever calls `sfx.play(name)`. Local prototype builds
 * intentionally tolerate the assets folder being empty. When bundled assets are
 * added, register their Metro `require()` values here (never in a screen).
 */
const bundledAssets: Partial<Record<SfxName, number>> = {};
class SfxService {
  private enabled = true; private volume = 0.55; private players = new Map<SfxName, AudioPlayer>(); private recent = new Map<SfxName, number>();
  async hydrate() { this.enabled = (await AsyncStorage.getItem(preferenceKey)) !== 'false'; }
  async setEnabled(enabled: boolean) { this.enabled = enabled; await AsyncStorage.setItem(preferenceKey, String(enabled)); if (!enabled) this.stopAll(); }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, volume)); }
  expectedFile(name: SfxName) { return files[name]; }
  async play(name: SfxName) {
    if (!this.enabled || bundledAssets[name] === undefined) return;
    const now = Date.now(); if ((now - (this.recent.get(name) ?? 0)) < 90) return; this.recent.set(name, now);
    try { await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }); let player = this.players.get(name); if (!player) { player = createAudioPlayer(bundledAssets[name]); this.players.set(name, player); } player.volume = this.volume; player.currentTime = 0; player.play(); } catch { /* Missing/corrupt optional SFX is always non-fatal. */ }
  }
  stopAll() { this.players.forEach((player) => player.pause()); }
  dispose() { this.players.forEach((player) => player.remove()); this.players.clear(); }
}
export const sfx = new SfxService();
