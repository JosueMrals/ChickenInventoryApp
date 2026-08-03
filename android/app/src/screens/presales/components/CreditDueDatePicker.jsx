// Selector de fecha de pago para preventas a crédito.
// Compartido entre el carrito, la edición y la pantalla de pago de preventa.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
};

const QUICK_DAYS = [7, 15, 30];

export default function CreditDueDatePicker({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);

  const selected = value instanceof Date ? value : null;

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Icon name="calendar-outline" size={14} color="#666" />
        <Text style={s.label}>Fecha de pago del crédito</Text>
      </View>

      <View style={s.controlsRow}>
        {QUICK_DAYS.map((days) => (
          <TouchableOpacity key={days} style={s.quickChip} onPress={() => onChange(addDays(days))}>
            <Text style={s.quickChipText}>{days} días</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.quickChip, s.dateChip]} onPress={() => setShowPicker(true)}>
          <Icon name="calendar" size={13} color="#007AFF" />
          <Text style={s.dateChipText}>
            {selected
              ? selected.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Elegir fecha'}
          </Text>
        </TouchableOpacity>
      </View>

      {!selected && <Text style={s.hint}>Selecciona cuándo se compromete a pagar el cliente.</Text>}

      {showPicker && (
        <DateTimePicker
          value={selected || addDays(7)}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowPicker(false);
            if (event.type !== 'dismissed' && date) {
              date.setHours(12, 0, 0, 0);
              onChange(date);
            }
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontSize: 12, color: '#666', fontWeight: '600' },
  controlsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  quickChip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#E0E0E0',
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EAF3FF', borderColor: '#007AFF',
  },
  dateChipText: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  hint: { fontSize: 11, color: '#C0392B', fontWeight: '600', marginTop: 6 },
});
