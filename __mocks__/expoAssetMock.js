/* global jest */
module.exports = {
  Asset: {
    loadAsync: jest.fn().mockResolvedValue([]),
    fromModule: jest.fn().mockReturnValue({ uri: 'mocked-uri', downloadAsync: jest.fn() }),
  },
};
