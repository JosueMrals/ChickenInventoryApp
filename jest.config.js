module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-reanimated|@react-native-community|react-native-vector-icons|react-native-drawer-layout)/)',
  ],
};
