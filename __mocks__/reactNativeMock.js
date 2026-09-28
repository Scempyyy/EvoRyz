/* global jest */
module.exports = {
  Platform: {
    OS: 'android',
    select: (obj) => obj.android ?? obj.default,
  },
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
    currentState: 'active',
  },
  Linking: {
    openSettings: jest.fn().mockResolvedValue(true),
    sendIntent: jest.fn().mockResolvedValue(true),
  },
};
