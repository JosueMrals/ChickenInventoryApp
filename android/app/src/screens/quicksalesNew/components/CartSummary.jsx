import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/quickCartStyles';

export default function CartSummary({ subtotal, total }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryText}>Subtotal: C${subtotal.toFixed(2)}</Text>
      <Text style={styles.totalMain}>Total: C${total.toFixed(2)}</Text>
    </View>
  );
}
