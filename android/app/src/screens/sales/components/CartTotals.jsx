import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/cartStyles';

export default function CartTotals({ subtotal, customerDiscount = 0 }) {
  const discountAmount = +(subtotal * (customerDiscount / 100) || 0).toFixed(2);
  const total = +(subtotal - discountAmount).toFixed(2);

  return (
    <View style={styles.totals}>
      <View style={styles.totRow}>
        <Text style={styles.totLabel}>Subtotal</Text>
        <Text style={styles.totValue}>C${subtotal.toFixed(2)}</Text>
      </View>

      <View style={styles.totRow}>
        <Text style={styles.totLabel}>Descuento cliente</Text>
        <Text style={styles.totValue}>{customerDiscount}% (-C${discountAmount.toFixed(2)})</Text>
      </View>

      <View style={[styles.totRow, { marginTop: 6 }]}>
        <Text style={[styles.totLabel, { fontWeight: '800' }]}>Total</Text>
        <Text style={[styles.totValue, { fontWeight: '800' }]}>C${total.toFixed(2)}</Text>
      </View>
    </View>
  );
}
