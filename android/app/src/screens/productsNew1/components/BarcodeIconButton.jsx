import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

let MaterialCommunityIcons;
try {
  MaterialCommunityIcons = require('react-native-vector-icons/MaterialCommunityIcons').default;
} catch (e) {
  MaterialCommunityIcons = null;
}

export default function BarcodeIconButton({ onPress, size = 22, color = '#111', accessibilityLabel = 'Abrir lector' }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button} accessibilityLabel={accessibilityLabel}>
      {MaterialCommunityIcons ? (
        <MaterialCommunityIcons name="barcode-scan" size={size} color={color} />
      ) : (
        <View style={styles.fallback}>
          <Text style={{ fontSize: size }}>📷</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
