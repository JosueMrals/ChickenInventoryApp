module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // __tests__/emulator/ requiere Firestore/Auth Emulator corriendo (npm run test:emulator),
  // no el mock de jest.setup.js — se excluye de la suite normal para no romper `npm test`.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/__tests__/emulator/'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  // Los paquetes react-native-* y @react-native*/ publican ESM/TS sin transpilar:
  // hay que pasarlos por babel en vez de irlos agregando de a uno.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|react-native-.*|@react-native[^/]*|@react-navigation|@bam\\.tech|sp-react-native-in-app-updates)/)',
  ],
};
