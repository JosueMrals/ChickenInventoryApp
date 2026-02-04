import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/quickPaymentStyles';

export default function PaymentTotals({ subtotal = 0, total = 0, discount = 0, finalTotal = 0, paid = 0 }) {
  // Sanitizar valores
  const sub = Number(subtotal) || 0;
  const tot = Number(total) || 0;
  const disc = Number(discount) || 0;
  const finalT = Number(finalTotal) || 0;
  const paidAmount = Number(paid) || 0;

  return (
    <View style={styles.totalBox}>
      <Text style={styles.totalRow}>Subtotal: C${sub.toFixed(2)}</Text>
      <Text style={styles.totalRow}>Descuento: -C${disc.toFixed(2)}</Text>
      <Text style={styles.totalMain}>Total Final: C${finalT.toFixed(2)}</Text>
      <Text style={styles.pendingRow}>
        Pendiente: C${Math.max(finalT - paidAmount, 0).toFixed(2)}
      </Text>
    </View>
  );
}

