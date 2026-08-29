import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { endOfDay, format, isSameDay, startOfDay, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

// Solo Pendientes y Pagados: la vista completa vive en el Historial de créditos.
const STATUS = [
  { id: 'pending', label: 'Pendientes', icon: 'clock-outline' },
  { id: 'paid', label: 'Pagados', icon: 'check-circle-outline' },
];

const PRESETS = [
  { id: 'today', label: 'Hoy', range: () => [startOfDay(new Date()), endOfDay(new Date())] },
  { id: '7d', label: '7 días', range: () => [startOfDay(subDays(new Date(), 6)), endOfDay(new Date())] },
  { id: 'month', label: 'Este mes', range: () => [startOfMonth(new Date()), endOfDay(new Date())] },
];

const short = (d) => format(d, 'dd MMM', { locale: es });

export const formatRange = (from, to) => {
  if (from && to) return `${short(from)} — ${short(to)}`;
  if (from) return `Desde ${short(from)}`;
  if (to) return `Hasta ${short(to)}`;
  return '';
};

// El preset activo se deriva de las fechas (que son la fuente de verdad en el
// hook) en vez de guardarse aparte: dos estados para lo mismo se desincronizan.
const activePreset = (from, to) => {
  if (!from || !to) return null;
  return PRESETS.find(({ range }) => {
    const [f, t] = range();
    return isSameDay(f, from) && isSameDay(t, to);
  })?.id || null;
};

export default function CreditsFilters({
  visible, onClose, filter, onChangeFilter, counts = {},
  dateFrom, dateTo, onChangeRange, onClear, onOpenHistory,
}) {
  // Rango personalizado en dos pasos: se pide "desde" y el picker se reabre en
  // "hasta". Cancelar el segundo paso deja el rango abierto (desde X en adelante).
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pendingFrom, setPendingFrom] = useState(null);

  const preset = activePreset(dateFrom, dateTo);
  const hasRange = !!(dateFrom || dateTo);

  const applyPreset = (p) => {
    const [f, t] = p.range();
    onChangeRange(f, t);
    onClose();
  };

  const handleConfirm = (date) => {
    if (pickerTarget === 'from') {
      setPendingFrom(date);
      setPickerTarget('to');
      return;
    }
    setPickerTarget(null);
    onChangeRange(pendingFrom, date);
    onClose();
  };

  const handleCancel = () => {
    if (pickerTarget === 'to' && pendingFrom) {
      onChangeRange(pendingFrom, null);
      onClose();
    }
    setPickerTarget(null);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={s.menu} activeOpacity={1} onPress={() => {}}>
            <Text style={s.sectionLabel}>Estado</Text>
            {STATUS.map((f) => {
              const active = filter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={s.item}
                  onPress={() => { onChangeFilter(f.id); onClose(); }}
                >
                  <Icon name={f.icon} size={18} color={active ? '#007AFF' : '#6B7280'} />
                  <Text style={[s.itemText, active && s.itemTextActive]}>{f.label}</Text>
                  {counts[f.id] != null && (
                    <View style={[s.count, active && s.countActive]}>
                      <Text style={[s.countText, active && s.countTextActive]}>{counts[f.id]}</Text>
                    </View>
                  )}
                  {active && <Icon name="check" size={16} color="#007AFF" />}
                </TouchableOpacity>
              );
            })}

            <View style={s.divider} />

            <Text style={s.sectionLabel}>Fecha</Text>
            <View style={s.chipRow}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.chip, preset === p.id && s.chipActive]}
                  onPress={() => applyPreset(p)}
                >
                  <Text style={[s.chipText, preset === p.id && s.chipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={s.item}
              onPress={() => { setPendingFrom(null); setPickerTarget('from'); }}
            >
              <Icon name="calendar-range" size={18} color={hasRange && !preset ? '#007AFF' : '#6B7280'} />
              <Text style={[s.itemText, hasRange && !preset && s.itemTextActive]}>
                {hasRange && !preset ? formatRange(dateFrom, dateTo) : 'Rango personalizado'}
              </Text>
            </TouchableOpacity>

            {hasRange && (
              <TouchableOpacity style={s.item} onPress={() => { onChangeRange(null, null); onClose(); }}>
                <Icon name="calendar-remove-outline" size={18} color="#6B7280" />
                <Text style={s.itemText}>Quitar fechas</Text>
              </TouchableOpacity>
            )}

            <View style={s.divider} />

            <TouchableOpacity style={s.item} onPress={() => { onClear(); onClose(); }}>
              <Icon name="filter-remove-outline" size={18} color="#6B7280" />
              <Text style={s.itemText}>Limpiar filtros</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.item} onPress={() => { onClose(); onOpenHistory(); }}>
              <Icon name="history" size={18} color="#6B7280" />
              <Text style={s.itemText}>Historial</Text>
              <Icon name="chevron-right" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <DateTimePickerModal
        isVisible={pickerTarget !== null}
        mode="date"
        locale="es"
        date={(pickerTarget === 'from' ? dateFrom : dateTo) || new Date()}
        // Sin `minimumDate` se podía elegir un "hasta" anterior al "desde": el
        // query no devolvería nada y parecería que no hay créditos.
        minimumDate={pickerTarget === 'to' ? pendingFrom || undefined : undefined}
        maximumDate={new Date()}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute', top: 84, right: 12, minWidth: 232,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 6,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#ECECEC',
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: 0.4, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  itemTextActive: { color: '#007AFF', fontWeight: '700' },
  count: { backgroundColor: '#F0F0F5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  countActive: { backgroundColor: '#EBF3FF' },
  countText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  countTextActive: { color: '#007AFF' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 6, marginHorizontal: 10 },
  chipRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F0F0F5' },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  chipTextActive: { color: '#fff' },
});
