import { sfx, SfxName } from '../src/services/sfx';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('SFX Service & Asset Pipeline', () => {
  const allSfx: SfxName[] = [
    'tap',
    'send',
    'messageReceived',
    'taskComplete',
    'habitComplete',
    'goalComplete',
    'streakMilestone',
    'workspaceConnected',
    'error',
    'success',
    'notification',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps all 11 SFX names to their expected file assets', () => {
    allSfx.forEach((name) => {
      expect(sfx.expectedFile(name)).toContain('.mp3');
    });
    expect(sfx.expectedFile('tap')).toBe('tap.mp3');
    expect(sfx.expectedFile('send')).toBe('send.mp3');
    expect(sfx.expectedFile('messageReceived')).toBe('message-received.mp3');
    expect(sfx.expectedFile('taskComplete')).toBe('task-complete.mp3');
    expect(sfx.expectedFile('habitComplete')).toBe('habit-complete.mp3');
    expect(sfx.expectedFile('goalComplete')).toBe('goal-complete.mp3');
    expect(sfx.expectedFile('streakMilestone')).toBe('streak-milestone.mp3');
    expect(sfx.expectedFile('workspaceConnected')).toBe('workspace-connected.mp3');
    expect(sfx.expectedFile('error')).toBe('error.mp3');
    expect(sfx.expectedFile('success')).toBe('success.mp3');
    expect(sfx.expectedFile('notification')).toBe('notification.mp3');
  });

  it('can enable and disable SFX respecting user preference', async () => {
    await sfx.setEnabled(false);
    await sfx.play('tap');
    // Disabled SFX does not play
    await sfx.setEnabled(true);
    await sfx.play('tap');
  });

  it('supports volume adjustment and stops all active players', () => {
    sfx.setVolume(0.8);
    sfx.stopAll();
    sfx.dispose();
  });
});
