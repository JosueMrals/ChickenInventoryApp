// Flat config (ESLint 9+). El preset de React Native ya viene en formato flat:
// @react-native/eslint-config/flat. Reemplaza a .eslintrc.js.
const reactNativeConfig = require('@react-native/eslint-config/flat');

module.exports = [
  {
    ignores: [
      'android/build/**',
      'android/app/build/**',
      'android/.gradle/**',
      'android/app/src/main/**',
      'functions/node_modules/**',
      'coverage/**',
      'vendor/**',
    ],
  },
  ...reactNativeConfig,

  // jest.setup.js queda fuera de los patrones de test del preset, pero usa jest.*
  {
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
];
