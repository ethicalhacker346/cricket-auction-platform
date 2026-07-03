export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {},
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
};
