module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleNameMapper: {
    '\\.(mp3|wav|m4a|ogg)$': '<rootDir>/__mocks__/fileMock.js',
    '^expo-asset$': '<rootDir>/__mocks__/expoAssetMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
