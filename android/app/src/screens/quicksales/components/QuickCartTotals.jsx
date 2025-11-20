import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/quickCartStyles';

export default function QuickCartTotals({ subtotal, discountPercent }) {
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2);
  const total = +(subtotal - discountAmount).toFixed(2);

  return (
    <View style={styles.totalsBox}>
      <Text style={styles.totalRow}>Subtotal: C${subtotal.toFixed(2)}</Text>
      <Text style={styles.totalRow}>
        Descuento: {discountPercent}% (−C${discountAmount.toFixed(2)})
      </Text>
      <Text style={styles.totalMain}>Total: C${total.toFixed(2)}</Text>
    </View>
  );
}
