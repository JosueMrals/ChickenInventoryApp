// Fecha de pago acordada + días de atraso de un crédito.
// Compartido entre CreditCard, CreditDetailScreen y el historial de créditos.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDaysOverdue, toDateSafe } from '../../../utils/creditUtils';

export default function CreditDueInfo({ credit, compact = false }) {
  const dueDate = toDateSafe(credit?.dueDate);
  if (!dueDate) return null;

  const daysOverdue = getDaysOverdue(credit);
  const isLate = daysOverdue > 0;
  const dateLabel = dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={[s.row, isLate ? s.rowLate : s.rowOk, compact && s.rowCompact]}>
      <Icon
        name={isLate ? 'alert-circle-outline' : 'calendar-check-outline'}
        size={compact ? 12 : 14}
        color={isLate ? '#DC2626' : '#6B7280'}
      />
      <Text style={[s.text, compact && s.textCompact, isLate && s.textLate]} numberOfLines={1}>
        {isLate
          ? `Venció ${dateLabel} · ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} de atraso`
          : `Fecha de pago: ${dateLabel}`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    marginBottom: 8, alignSelf: 'stretch',
  },
  rowCompact: { paddingVertical: 3, marginBottom: 6 },
  rowOk: { backgroundColor: '#F3F4F6' },
  rowLate: { backgroundColor: '#FEE2E2' },
  text: { flex: 1, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  textCompact: { fontSize: 10 },
  textLate: { color: '#DC2626', fontWeight: '700' },
});
