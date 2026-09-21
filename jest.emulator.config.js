// Config separada de jest.config.js: estos tests hablan con el Firestore/Auth
// Emulator real (SDK web `firebase`, no @react-native-firebase — ver
// audit-reports/fase22-*.md para el motivo). No usan jest.setup.js porque no
// necesitan ninguno de sus mocks de React Native.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/emulator/**/*.test.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testTimeout: 20000,
};
