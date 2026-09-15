// Fecha de pago del crédito: solo lectura. El plazo (días desde la venta o
// día fijo del mes) lo configura el admin en la ficha del cliente
// (creditTermType/creditTermDays/creditTermDay, ver creditUtils.js); el
// vendedor ya no elige la fecha por venta, solo la ve.
// Compartido entre el carrito, la edición y el cobro de preventa.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { describeCreditTerm } from '../../../utils/creditUtils';

export default function CreditDueDatePicker({ customer, dueDate }) {
  const formatted = dueDate instanceof Date && !Number.isNaN(dueDate.getTime())
    ? dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Icon name="calendar-outline" size={14} color="#666" />
        <Text style={s.label}>Fecha de pago del crédito</Text>
      </View>

      <View style={s.dateChip}>
        <Icon name="calendar" size={13} color="#007AFF" />
        <Text style={s.dateChipText}>{formatted || 'Sin fecha calculada'}</Text>
      </View>

      <Text style={s.hint}>{describeCreditTerm(customer)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontSize: 12, color: '#666', fontWeight: '600' },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#007AFF',
  },
  dateChipText: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  hint: { fontSize: 11, color: '#8E8E93', marginTop: 6 },
});
